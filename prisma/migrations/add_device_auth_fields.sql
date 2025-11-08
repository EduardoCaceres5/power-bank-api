-- Add device authentication fields to Cabinet model
-- Migration: add_device_auth_fields

-- Add new columns to cabinets table
ALTER TABLE "cabinets"
  ADD COLUMN IF NOT EXISTS "deviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "connectionType" TEXT;

-- Create unique index on deviceId
CREATE UNIQUE INDEX IF NOT EXISTS "cabinets_deviceId_key" ON "cabinets"("deviceId");

-- Create index on deviceId for faster lookups
CREATE INDEX IF NOT EXISTS "cabinets_deviceId_idx" ON "cabinets"("deviceId");
