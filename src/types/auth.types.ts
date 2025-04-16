export interface IAuthRegisterRequest {
  email: string;
  password: string;
  username?: string;
}

export interface IAuthLoginRequest {
  email: string;
}

export interface IAuthVerifyLoginRequest {
  email: string;
  code: string;
}

export interface IAuthResponse {
  user: {
    id: string;
    email: string;
    username?: string;
    status: string;
  };
  token: string;
}

export interface ILoginSession {
  userId: string;
  email: string;
  loginCode: string;
  loginCodeExpires: Date;
  createdAt: Date;
  updatedAt: Date;
} 