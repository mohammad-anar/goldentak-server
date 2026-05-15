export type ICreateAccount = {
  name: string;
  email: string;
  otp: number;
};

export type IResetPassword = {
  email: string;
  otp: number;
};

export type IContactEmail = {
  name: string;
  email: string;
  subject: string;
  message: string;
};


