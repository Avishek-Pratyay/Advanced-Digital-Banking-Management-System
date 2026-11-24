import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const COST = 10;

export const hashSecret = (plain: string) => bcrypt.hash(plain, COST);
export const verifySecret = (plain: string, hash: string | null | undefined) => (hash ? bcrypt.compare(plain, hash) : Promise.resolve(false));

authenticator.options = { window: 1 }; // tolerate 30s clock drift

export const newTotpSecret = () => authenticator.generateSecret();
export const verifyTotp = (code: string, secret: string) => {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
};
export const totpUri = (email: string, secret: string) => authenticator.keyuri(email, "Vaultline Bank", secret);
export const qrDataUrl = (uri: string) => QRCode.toDataURL(uri, { margin: 1, width: 220 });

/** Cryptographically random helpers used for public identifiers. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function randomCode(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
export function randomDigits(len: number): string {
  let out = "";
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += String(bytes[i] % 10);
  return out;
}
const stamp = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, "");
export const newTxnId = () => `TXN-${stamp()}-${randomCode(8)}`;
export const newLoanNumber = () => `LN-${stamp()}-${randomCode(5)}`;
export const newRequestNumber = () => `REQ-${stamp()}-${randomCode(5)}`;
export const newAccountNumber = () => `10${randomDigits(10)}`; // 12 digits
export const newCustomerNumber = () => `CUS-${randomDigits(6)}`;
export const generatePassword = () => `${randomCode(4)}${randomCode(4).toLowerCase()}${randomDigits(3)}!`;
export const generatePin = () => randomDigits(4);

/** Tamper-evident receipt reference: first 10 hex chars of an HMAC over the immutable transaction facts. */
export function receiptReference(txnId: string, amountCents: number, createdAt: Date): string {
  const secret = process.env.RECEIPT_SECRET || process.env.NEXTAUTH_SECRET || "vaultline-dev";
  return crypto.createHmac("sha256", secret).update(`${txnId}|${amountCents}|${createdAt.toISOString()}`).digest("hex").slice(0, 10).toUpperCase();
}
