use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("EaDhVtTXRSJrzGNkLGYsA5cQWFPwEYh1vAjF4yh7hUBP");

// Constants
pub const MIN_INITIAL_PRICE: u64 = 100_000_000;   // 0.1 SOL
pub const MAX_INITIAL_PRICE: u64 = 1_000_000_000; // 1 SOL
pub const DEV_ADDRESS: &str = "8BcW6T4Sm3tMtE9LJET1oU1vQec6m9R8LifnauQwshCi";
pub const MIN_PRICE_MULTIPLIER: u64 = 12000; // 1.2 in basis points (1.2 * 10000)
pub const MAX_PRICE_MULTIPLIER: u64 = 20000; // 2.0 in basis points (2.0 * 10000)

#[program]
pub mod steal_token {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        name: String,
        symbol: String,
        description: String,
        image: String,
        initial_price: u64,
        price_increment: u64,
        bump: u8,
    ) -> Result<()> {
        let event = InitializeEvent {
            token: ctx.accounts.token.key(),
            minter: ctx.accounts.minter.key(),
            dev: ctx.accounts.dev.key(),
            initial_price,
            initial_next_price: initial_price + (initial_price / 5),
        };

        let token = &mut ctx.accounts.token;
        
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(symbol.len() <= 8, ErrorCode::SymbolTooLong);
        require!(description.len() <= 200, ErrorCode::DescriptionTooLong);
        require!(image.len() <= 200, ErrorCode::ImageUrlTooLong);
        require!(
            initial_price >= MIN_INITIAL_PRICE && initial_price <= MAX_INITIAL_PRICE,
            ErrorCode::InvalidInitialPrice
        );
        require!(
            price_increment >= MIN_PRICE_MULTIPLIER && price_increment <= MAX_PRICE_MULTIPLIER,
            ErrorCode::InvalidPriceIncrement
        );
        let dev_pubkey = Pubkey::try_from(DEV_ADDRESS).map_err(|_| ErrorCode::InvalidDevAddress)?;
        require!(
            ctx.accounts.dev.key() == dev_pubkey,
            ErrorCode::InvalidDevAddress
        );

        token.name = name;
        token.symbol = symbol;
        token.description = description;
        token.image = image;
        token.current_holder = ctx.accounts.minter.key();
        token.minter = ctx.accounts.minter.key();
        token.dev = ctx.accounts.dev.key();
        token.current_price = initial_price;
        token.price_increment = price_increment;
        token.next_price = initial_price
            .checked_mul(price_increment)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::NumericalOverflow)?;
        token.bump = bump;
        token.first_steal_completed = false;
        token.previous_price = 0;

        emit!(event);
        Ok(())
    }

    pub fn steal(ctx: Context<Steal>, amount: u64) -> Result<()> {
        // Verify payment amount is sufficient
        require!(
            amount >= ctx.accounts.token.current_price,
            ErrorCode::InsufficientPayment
        );

        // Process the steal first to get fee calculations
        let calc = ctx.accounts.token.process_steal(ctx.accounts.stealer.key())?;

        // Calculate total cost (holder payment + fees)
        let total_cost = calc.holder_payment
            .checked_add(calc.dev_fee)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_add(calc.minter_fee)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Calculate refund if overpaid
        let refund_amount = if amount > total_cost {
            amount.checked_sub(total_cost).ok_or(ErrorCode::NumericalOverflow)?
        } else {
            0
        };

        // Transfer to holder
        let holder_cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.stealer.to_account_info(),
                to: ctx.accounts.current_holder.to_account_info(),
            },
        );
        system_program::transfer(holder_cpi_context, calc.holder_payment)?;

        // Transfer fees
        if calc.dev_fee > 0 {
            let dev_cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.stealer.to_account_info(),
                    to: ctx.accounts.dev.to_account_info(),
                },
            );
            system_program::transfer(dev_cpi_context, calc.dev_fee)?;
        }

        if calc.minter_fee > 0 {
            let minter_cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.stealer.to_account_info(),
                    to: ctx.accounts.minter.to_account_info(),
                },
            );
            system_program::transfer(minter_cpi_context, calc.minter_fee)?;
        }

        // Process refund if any
        if refund_amount > 0 {
            let refund_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.stealer.to_account_info(),
                    to: ctx.accounts.stealer.to_account_info(),
                },
            );
            system_program::transfer(refund_context, refund_amount)?;
        }

        emit!(StealEvent {
            token: ctx.accounts.token.key(),
            previous_holder: ctx.accounts.current_holder.key(),
            new_holder: ctx.accounts.stealer.key(),
            price_paid: amount,
            price_increase: ctx.accounts.token.current_price - ctx.accounts.token.previous_price,
            dev_fee: calc.dev_fee,
            minter_fee: calc.minter_fee,
            is_first_steal: !ctx.accounts.token.first_steal_completed,
            holder_payment: calc.holder_payment,
            refund_amount,
            next_price: ctx.accounts.token.next_price,
        });

        Ok(())
    }

    pub fn transfer(ctx: Context<Transfer>) -> Result<()> {
        let token = &mut ctx.accounts.token;
        let current_holder = &ctx.accounts.current_holder;
        let new_holder = &ctx.accounts.new_holder;

        // Verify current holder
        require!(
            current_holder.key() == token.current_holder,
            ErrorCode::NotCurrentHolder
        );

        // Update current holder
        token.current_holder = new_holder.key();

        emit!(TransferEvent {
            token: token.key(),
            from: current_holder.key(),
            to: new_holder.key(),
            price: token.current_price,
            next_price: token.next_price,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(
    name: String,
    symbol: String,
    description: String,
    image: String,
    initial_price: u64,
    bump: u8,
)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = minter,
        space = CustomToken::MAXIMUM_SIZE,
        seeds = [b"token", minter.key().as_ref(), name.as_bytes()],
        bump,
    )]
    pub token: Account<'info, CustomToken>,
    
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// CHECK: Dev address verified in instruction
    pub dev: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Steal<'info> {
    #[account(mut)]
    pub token: Account<'info, CustomToken>,
    
    #[account(mut)]
    pub stealer: Signer<'info>,
    
    #[account(
        mut,
        constraint = current_holder.key() == token.current_holder
    )]
    /// CHECK: Current holder verified by constraint
    pub current_holder: UncheckedAccount<'info>,
    
    #[account(
        mut,
        constraint = dev.key() == Pubkey::try_from(DEV_ADDRESS).unwrap()
    )]
    /// CHECK: Dev address verified by constraint
    pub dev: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = minter.key() == token.minter
    )]
    /// CHECK: Minter address verified by constraint
    pub minter: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut)]
    pub token: Account<'info, CustomToken>,
    
    #[account(
        constraint = current_holder.key() == token.current_holder
    )]
    pub current_holder: Signer<'info>,
    
    /// CHECK: New holder can be any valid pubkey
    pub new_holder: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CustomToken {
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub image: String,
    pub current_holder: Pubkey,
    pub minter: Pubkey,
    pub dev: Pubkey,
    pub current_price: u64,
    pub next_price: u64,
    pub price_increment: u64,
    pub bump: u8,
    first_steal_completed: bool,
    previous_price: u64,
}

impl CustomToken {
    pub const MAXIMUM_SIZE: usize = 8 +    // discriminator
        4 + 32 +                           // name (string prefix + max chars)
        4 + 8 +                            // symbol (string prefix + max chars)
        4 + 200 +                          // description (string prefix + max chars)
        4 + 200 +                          // image url (string prefix + max chars)
        32 +                               // current_holder
        32 +                               // minter
        32 +                               // dev
        8 +                                // current_price
        8 +                                // next_price
        8 +                                // price_increment
        1 +                                // bump
        1 +                                // first_steal_completed
        8 +                                // previous_price
        100;                               // padding for safety

    pub fn calculate_next_price(&self) -> Result<u64> {
        // Calculate price increase using price_increment (stored in basis points)
        let increase = self.current_price
            .checked_mul(self.price_increment)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(10000)  // Convert from basis points
            .ok_or(ErrorCode::NumericalOverflow)?;
        
        Ok(increase)  // Return the new price directly
    }

    pub fn process_steal(&mut self, stealer: Pubkey) -> Result<StealCalculation> {
        let (dev_fee, minter_fee, holder_payment) = if !self.first_steal_completed {
            // First steal: Entire amount split 50/50 between dev and minter
            let half_amount = self.current_price
                .checked_div(2)
                .ok_or(ErrorCode::NumericalOverflow)?;
            
            (half_amount, half_amount, 0u64)
        } else {
            // Calculate fees based on current price, not price increase
            let total_fee = self.current_price
                .checked_mul(1000) // 10% = 1000 basis points
                .ok_or(ErrorCode::NumericalOverflow)?
                .checked_div(10000)
                .ok_or(ErrorCode::NumericalOverflow)?;

            // Calculate 80/20 split of the fee
            let dev_fee = total_fee
                .checked_mul(80)
                .ok_or(ErrorCode::NumericalOverflow)?
                .checked_div(100)
                .ok_or(ErrorCode::NumericalOverflow)?;

            let minter_fee = total_fee
                .checked_mul(20)
                .ok_or(ErrorCode::NumericalOverflow)?
                .checked_div(100)
                .ok_or(ErrorCode::NumericalOverflow)?;

            // Holder gets the current price minus fees
            let holder_payment = self.current_price
                .checked_sub(total_fee)
                .ok_or(ErrorCode::NumericalOverflow)?;

            (dev_fee, minter_fee, holder_payment)
        };

        // Update prices
        self.previous_price = self.current_price;
        self.current_price = self.next_price;
        self.next_price = self.calculate_next_price()?;
        self.current_holder = stealer;
        
        if !self.first_steal_completed {
            self.first_steal_completed = true;
        }

        Ok(StealCalculation {
            dev_fee,
            minter_fee,
            holder_payment,
        })
    }
}

pub struct StealCalculation {
    pub dev_fee: u64,
    pub minter_fee: u64,
    pub holder_payment: u64,
}

#[event]
pub struct InitializeEvent {
    pub token: Pubkey,
    pub minter: Pubkey,
    pub dev: Pubkey,
    pub initial_price: u64,
    pub initial_next_price: u64,
}

#[event]
pub struct StealEvent {
    pub token: Pubkey,
    pub previous_holder: Pubkey,
    pub new_holder: Pubkey,
    pub price_paid: u64,
    pub price_increase: u64,
    pub dev_fee: u64,
    pub minter_fee: u64,
    pub is_first_steal: bool,
    pub holder_payment: u64,
    pub refund_amount: u64,
    pub next_price: u64,
}

#[event]
pub struct TransferEvent {
    pub token: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub price: u64,
    pub next_price: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Name must be 32 characters or less")]
    NameTooLong,
    #[msg("Symbol must be 8 characters or less")]
    SymbolTooLong,
    #[msg("Description must be 200 characters or less")]
    DescriptionTooLong,
    #[msg("Image URL must be 200 characters or less")]
    ImageUrlTooLong,
    #[msg("Initial price must be between 0.1 and 1 SOL")]
    InvalidInitialPrice,
    #[msg("Payment amount is less than current price")]
    InsufficientPayment,
    #[msg("Numerical overflow")]
    NumericalOverflow,
    #[msg("Invalid dev address")]
    InvalidDevAddress,
    #[msg("Only the current holder can transfer the token")]
    NotCurrentHolder,
    #[msg("Price increment must be between 12000 and 20000 (1.2x to 2.0x)")]
    InvalidPriceIncrement,
}