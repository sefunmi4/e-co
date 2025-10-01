import dotenv from 'dotenv';

dotenv.config();

const required = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required(process.env.JWT_SECRET, 'JWT_SECRET'),
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? 10),
};
