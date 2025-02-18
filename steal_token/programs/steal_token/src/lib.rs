use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("9P9GUVz1EMfe3KF6NKgM7kMGkuETKGLei7yHmoETD9gN");

// Constants
pub const MIN_INITIAL_PRICE: u64 = 100_000_000;   // 0.1 SOL
pub const MAX_INITIAL_PRICE: u64 = 1_000_000_000; // 1 SOL
pub const DEV_ADDRESS: &str = "9P9GUVz1EMfe3KF6NKgM7kMGkuETKGLei7yHmoETD9gN";

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
        bump: u8,
    ) -> Result<()> {
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(symbol.len() <= 8, ErrorCode::SymbolTooLong);
        require!(description.len() <= 200, ErrorCode::DescriptionTooLong);
        require!(image.len() <= 200, ErrorCode::ImageUrlTooLong);
        require!(
            initial_price >= MIN_INITIAL_PRICE && initial_price <= MAX_INITIAL_PRICE,
            ErrorCode::InvalidInitialPrice
        );
        let dev_pubkey = Pubkey::try_from(DEV_ADDRESS).map_err(|_| ErrorCode::InvalidDevAddress)?;
        require!(
            ctx.accounts.dev.key() == dev_pubkey,
            ErrorCode::InvalidDevAddress
        );

        ctx.accounts.token.initialize(
            name,
            symbol,
            description,
            image,
            ctx.accounts.minter.key(),
            ctx.accounts.dev.key(),
            initial_price,
            bump,
        )?;

        emit!(InitializeEvent {
            token: ctx.accounts.token.key(),
            minter: ctx.accounts.minter.key(),
            dev: ctx.accounts.dev.key(),
            initial_price,
            initial_next_price: ctx.accounts.token.next_price,
        });

        Ok(())
    }

    pub fn steal(ctx: Context<Steal>) -> Result<()> {
        let token = &mut ctx.accounts.token;
        let stealer = &ctx.accounts.stealer;
        
        // Verify payment amount
        let amount_sent = ctx.accounts.vault.lamports();
        require!(
            amount_sent >= token.current_price,
            ErrorCode::InsufficientPayment
        );

        // Process steal and get calculations
        let calc = token.process_steal(stealer.key())?;

        // Transfer dev fee
        if calc.dev_fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.dev.to_account_info(),
                    },
                ),
                calc.dev_fee,
            )?;
        }

        // Transfer minter fee
        if calc.minter_fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.minter.to_account_info(),
                    },
                ),
                calc.minter_fee,
            )?;
        }

        // Transfer to previous holder (only after first steal)
        if calc.holder_payment > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.current_holder.to_account_info(),
                    },
                ),
                calc.holder_payment,
            )?;
        }

        // Process refund if necessary
        let refund_amount = amount_sent
            .checked_sub(token.current_price)
            .unwrap_or(0);

        if refund_amount > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: stealer.to_account_info(),
                    },
                ),
                refund_amount,
            )?;
        }

        emit!(StealEvent {
            token: token.key(),
            previous_holder: calc.previous_holder,
            new_holder: stealer.key(),
            price_paid: token.current_price,
            price_increase: calc.price_increase,
            dev_fee: calc.dev_fee,
            minter_fee: calc.minter_fee,
            is_first_steal: calc.is_first_steal,
            holder_payment: calc.holder_payment,
            refund_amount,
            next_price: calc.new_next_price,
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
    
    #[account(mut)]
    /// CHECK: Temporary vault for payment processing
    pub vault: UncheckedAccount<'info>,
    
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
        32 +                               // name
        8 +                                // symbol
        200 +                             // description
        200 +                             // image
        32 +                              // current_holder
        32 +                              // minter
        32 +                              // dev
        8 +                               // current_price
        8 +                               // next_price
        8 +                               // price_increment
        1 +                               // bump
        1 +                               // first_steal_completed
        8;                                // previous_price

    pub fn initialize(
        &mut self,
        name: String,
        symbol: String,
        description: String,
        image: String,
        minter: Pubkey,
        dev: Pubkey,
        initial_price: u64,
        bump: u8,
    ) -> Result<()> {
        self.name = name;
        self.symbol = symbol;
        self.description = description;
        self.image = image;
        self.current_holder = minter;
        self.minter = minter;
        self.dev = dev;
        self.current_price = initial_price;
        self.next_price = self.calculate_next_price()?;
        self.previous_price = 0;
        self.price_increment = 12000;      // 1.2x
        self.bump = bump;
        self.first_steal_completed = false;
        Ok(())
    }

    pub fn calculate_next_price(&self) -> Result<u64> {
        Ok(self
            .current_price
            .checked_mul(self.price_increment)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::NumericalOverflow)?)
    }

    pub fn process_steal(&mut self, stealer: Pubkey) -> Result<StealCalculation> {
        // Calculate price increase
        let price_increase = self.current_price
            .checked_sub(self.previous_price)
            .ok_or(ErrorCode::NumericalOverflow)?;

        let (dev_fee, minter_fee, holder_payment) = if !self.first_steal_completed {
            // First steal: Entire amount split 50/50 between dev and minter
            let half_amount = self.current_price
                .checked_div(2)
                .ok_or(ErrorCode::NumericalOverflow)?;
            
            (half_amount, half_amount, 0u64)
        } else {
            // Subsequent steals: Normal 10% fee split 80/20
            let total_fee = price_increase
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

            // Calculate holder payment
            let holder_payment = self.previous_price
                .checked_add(
                    price_increase
                        .checked_sub(total_fee)
                        .ok_or(ErrorCode::NumericalOverflow)?
                )
                .ok_or(ErrorCode::NumericalOverflow)?;

            (dev_fee, minter_fee, holder_payment)
        };

        // Update token state
        let old_holder = self.current_holder;
        self.previous_price = self.current_price;
        self.current_price = self.next_price;
        self.next_price = self.calculate_next_price()?;
        self.current_holder = stealer;
        
        // Mark first steal as completed
        if !self.first_steal_completed {
            self.first_steal_completed = true;
        }

        Ok(StealCalculation {
            previous_holder: old_holder,
            price_increase,
            dev_fee,
            minter_fee,
            holder_payment,
            new_next_price: self.next_price,
            is_first_steal: !self.first_steal_completed,
        })
    }
}

pub struct StealCalculation {
    pub previous_holder: Pubkey,
    pub price_increase: u64,
    pub dev_fee: u64,
    pub minter_fee: u64,
    pub holder_payment: u64,
    pub new_next_price: u64,
    pub is_first_steal: bool,
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
}