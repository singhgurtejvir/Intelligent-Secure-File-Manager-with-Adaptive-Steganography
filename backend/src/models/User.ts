import { Schema, model } from 'mongoose'

interface IUser {
  _id?: string
  email: string
  passwordHash: string
  recoveryKey: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    recoveryKey: { type: String, required: true },
  },
  {
    timestamps: true,
  },
)

export const User = model<IUser>('User', UserSchema)
