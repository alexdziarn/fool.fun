export const IDL = {
  "address": "FesSNkUMZv5faqXuwXGqmDedin46bXkzmfPzNYx17T8k",
  "metadata": {
    "name": "steal_token",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "token",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "minter"
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "minter",
          "writable": true,
          "signer": true
        },
        {
          "name": "dev"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "image",
          "type": "string"
        },
        {
          "name": "initial_price",
          "type": "u64"
        },
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "steal",
      "discriminator": [
        106,
        222,
        218,
        118,
        8,
        131,
        144,
        221
      ],
      "accounts": [
        {
          "name": "token",
          "writable": true
        },
        {
          "name": "stealer",
          "writable": true,
          "signer": true
        },
        {
          "name": "current_holder",
          "writable": true
        },
        {
          "name": "dev",
          "writable": true
        },
        {
          "name": "minter",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "transfer",
      "discriminator": [
        163,
        52,
        200,
        231,
        140,
        3,
        69,
        186
      ],
      "accounts": [
        {
          "name": "token",
          "writable": true
        },
        {
          "name": "current_holder",
          "signer": true
        },
        {
          "name": "new_holder"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "CustomToken",
      "discriminator": [
        85,
        143,
        70,
        40,
        27,
        4,
        170,
        124
      ]
    }
  ],
  "events": [
    {
      "name": "InitializeEvent",
      "discriminator": [
        206,
        175,
        169,
        208,
        241,
        210,
        35,
        221
      ]
    },
    {
      "name": "StealEvent",
      "discriminator": [
        50,
        237,
        181,
        144,
        7,
        155,
        148,
        162
      ]
    },
    {
      "name": "TransferEvent",
      "discriminator": [
        100,
        10,
        46,
        113,
        8,
        28,
        179,
        125
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "NameTooLong",
      "msg": "Name must be 32 characters or less"
    },
    {
      "code": 6001,
      "name": "SymbolTooLong",
      "msg": "Symbol must be 8 characters or less"
    },
    {
      "code": 6002,
      "name": "DescriptionTooLong",
      "msg": "Description must be 200 characters or less"
    },
    {
      "code": 6003,
      "name": "ImageUrlTooLong",
      "msg": "Image URL must be 200 characters or less"
    },
    {
      "code": 6004,
      "name": "InvalidInitialPrice",
      "msg": "Initial price must be between 0.1 and 1 SOL"
    },
    {
      "code": 6005,
      "name": "InsufficientPayment",
      "msg": "Payment amount is less than current price"
    },
    {
      "code": 6006,
      "name": "NumericalOverflow",
      "msg": "Numerical overflow"
    },
    {
      "code": 6007,
      "name": "InvalidDevAddress",
      "msg": "Invalid dev address"
    },
    {
      "code": 6008,
      "name": "NotCurrentHolder",
      "msg": "Only the current holder can transfer the token"
    }
  ],
  "types": [
    {
      "name": "CustomToken",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "image",
            "type": "string"
          },
          {
            "name": "current_holder",
            "type": "pubkey"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "dev",
            "type": "pubkey"
          },
          {
            "name": "current_price",
            "type": "u64"
          },
          {
            "name": "next_price",
            "type": "u64"
          },
          {
            "name": "price_increment",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "first_steal_completed",
            "type": "bool"
          },
          {
            "name": "previous_price",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "InitializeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "dev",
            "type": "pubkey"
          },
          {
            "name": "initial_price",
            "type": "u64"
          },
          {
            "name": "initial_next_price",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "StealEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "previous_holder",
            "type": "pubkey"
          },
          {
            "name": "new_holder",
            "type": "pubkey"
          },
          {
            "name": "price_paid",
            "type": "u64"
          },
          {
            "name": "price_increase",
            "type": "u64"
          },
          {
            "name": "dev_fee",
            "type": "u64"
          },
          {
            "name": "minter_fee",
            "type": "u64"
          },
          {
            "name": "is_first_steal",
            "type": "bool"
          },
          {
            "name": "holder_payment",
            "type": "u64"
          },
          {
            "name": "refund_amount",
            "type": "u64"
          },
          {
            "name": "next_price",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "TransferEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "next_price",
            "type": "u64"
          }
        ]
      }
    }
  ]
}