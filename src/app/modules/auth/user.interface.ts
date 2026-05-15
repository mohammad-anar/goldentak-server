export interface IUser {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  timezone?: string;
}

export interface IVerifyEmail {
  email: string;
  otp: number | string;
}

export interface ILogin {
  email: string;
  password: string;
}

export interface IRegister {
  name: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  timezone?: string;
}

export interface IChangePassword {
  oldPassword: string;
  newPassword: string;
}

export interface IUserFilterRequest {
  searchTerm?: string;
  role?: string;
  isVerified?: boolean;
}
