-- Anti replay kode 2FA login
ALTER TABLE "User" ADD COLUMN "totpLastStep" INTEGER;
