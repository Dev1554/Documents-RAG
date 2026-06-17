import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { AuthRequest, AuthUser } from '../types';

interface JwtPayload {
  id: string;
  email: string;
  name: string;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;

  if (!authHeader?.startsWith('Bearer ') && !queryToken) {
    return next(new AppError('Authentication required', 401));
  }

  const token = queryToken || authHeader!.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    } as AuthUser;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}
