-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CASHIER', 'RESIDENT', 'SECURITY', 'AUDITOR');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('OWNER_OCCUPIED', 'TENANT_OCCUPIED', 'VACANT', 'UNSOLD');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('OWNED', 'RENTED', 'SOCIETY_ALLOTTED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Society" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "securityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "securityVehicles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Society_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocietyMembership" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SocietyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flat" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "flatType" TEXT NOT NULL,
    "areaSqFt" DECIMAL(12,3) NOT NULL,
    "billableAreaSqFt" DECIMAL(12,3) NOT NULL,
    "areaBasis" TEXT NOT NULL,
    "classification" "Classification" NOT NULL DEFAULT 'VACANT',
    "internalRemarks" TEXT NOT NULL DEFAULT '',
    "residentRemarks" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Flat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "approvedPhone" TEXT,
    "internalNotes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ownership" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,

    CONSTRAINT "Ownership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "kind" TEXT NOT NULL,

    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidentAccessGrant" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "occupancyId" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "revokedAt" TIMESTAMP(3),
    "historicalDocuments" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResidentAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSlot" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "ParkingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingEntitlement" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "basis" TEXT NOT NULL,

    CONSTRAINT "ParkingEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingAllocation" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "type" "AllocationType" NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "rentalTerms" TEXT,

    CONSTRAINT "ParkingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "allocationId" TEXT,
    "registration" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocietyMembership_societyId_id_key" ON "SocietyMembership"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SocietyMembership_societyId_userId_key" ON "SocietyMembership"("societyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocietyMembership_societyId_personId_key" ON "SocietyMembership"("societyId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Phase_societyId_id_key" ON "Phase"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Phase_societyId_name_key" ON "Phase"("societyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Block_societyId_id_key" ON "Block"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Block_societyId_phaseId_name_key" ON "Block"("societyId", "phaseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Flat_societyId_id_key" ON "Flat"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Flat_societyId_blockId_number_key" ON "Flat"("societyId", "blockId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Person_societyId_id_key" ON "Person"("societyId", "id");

-- CreateIndex
CREATE INDEX "Ownership_societyId_flatId_idx" ON "Ownership"("societyId", "flatId");

-- CreateIndex
CREATE UNIQUE INDEX "Ownership_societyId_id_key" ON "Ownership"("societyId", "id");

-- CreateIndex
CREATE INDEX "Occupancy_societyId_flatId_idx" ON "Occupancy"("societyId", "flatId");

-- CreateIndex
CREATE UNIQUE INDEX "Occupancy_societyId_id_key" ON "Occupancy"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Occupancy_societyId_id_flatId_key" ON "Occupancy"("societyId", "id", "flatId");

-- CreateIndex
CREATE INDEX "ResidentAccessGrant_societyId_membershipId_revokedAt_idx" ON "ResidentAccessGrant"("societyId", "membershipId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentAccessGrant_societyId_id_key" ON "ResidentAccessGrant"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSlot_societyId_id_key" ON "ParkingSlot"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSlot_societyId_label_key" ON "ParkingSlot"("societyId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingEntitlement_societyId_id_key" ON "ParkingEntitlement"("societyId", "id");

-- CreateIndex
CREATE INDEX "ParkingAllocation_societyId_flatId_idx" ON "ParkingAllocation"("societyId", "flatId");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingAllocation_societyId_id_key" ON "ParkingAllocation"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingAllocation_societyId_id_flatId_key" ON "ParkingAllocation"("societyId", "id", "flatId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_societyId_id_key" ON "Vehicle"("societyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_societyId_registration_key" ON "Vehicle"("societyId", "registration");

-- CreateIndex
CREATE INDEX "AuditEvent_societyId_createdAt_idx" ON "AuditEvent"("societyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_societyId_id_key" ON "AuditEvent"("societyId", "id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyMembership" ADD CONSTRAINT "SocietyMembership_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyMembership" ADD CONSTRAINT "SocietyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyMembership" ADD CONSTRAINT "SocietyMembership_societyId_personId_fkey" FOREIGN KEY ("societyId", "personId") REFERENCES "Person"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_societyId_phaseId_fkey" FOREIGN KEY ("societyId", "phaseId") REFERENCES "Phase"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flat" ADD CONSTRAINT "Flat_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flat" ADD CONSTRAINT "Flat_societyId_blockId_fkey" FOREIGN KEY ("societyId", "blockId") REFERENCES "Block"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_societyId_flatId_fkey" FOREIGN KEY ("societyId", "flatId") REFERENCES "Flat"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_societyId_personId_fkey" FOREIGN KEY ("societyId", "personId") REFERENCES "Person"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_societyId_flatId_fkey" FOREIGN KEY ("societyId", "flatId") REFERENCES "Flat"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_societyId_personId_fkey" FOREIGN KEY ("societyId", "personId") REFERENCES "Person"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentAccessGrant" ADD CONSTRAINT "ResidentAccessGrant_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentAccessGrant" ADD CONSTRAINT "ResidentAccessGrant_societyId_membershipId_fkey" FOREIGN KEY ("societyId", "membershipId") REFERENCES "SocietyMembership"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentAccessGrant" ADD CONSTRAINT "ResidentAccessGrant_societyId_flatId_fkey" FOREIGN KEY ("societyId", "flatId") REFERENCES "Flat"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentAccessGrant" ADD CONSTRAINT "ResidentAccessGrant_societyId_occupancyId_flatId_fkey" FOREIGN KEY ("societyId", "occupancyId", "flatId") REFERENCES "Occupancy"("societyId", "id", "flatId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSlot" ADD CONSTRAINT "ParkingSlot_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingEntitlement" ADD CONSTRAINT "ParkingEntitlement_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingEntitlement" ADD CONSTRAINT "ParkingEntitlement_societyId_slotId_fkey" FOREIGN KEY ("societyId", "slotId") REFERENCES "ParkingSlot"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingEntitlement" ADD CONSTRAINT "ParkingEntitlement_societyId_flatId_fkey" FOREIGN KEY ("societyId", "flatId") REFERENCES "Flat"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_societyId_slotId_fkey" FOREIGN KEY ("societyId", "slotId") REFERENCES "ParkingSlot"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_societyId_flatId_fkey" FOREIGN KEY ("societyId", "flatId") REFERENCES "Flat"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_societyId_flatId_fkey" FOREIGN KEY ("societyId", "flatId") REFERENCES "Flat"("societyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_societyId_allocationId_flatId_fkey" FOREIGN KEY ("societyId", "allocationId", "flatId") REFERENCES "ParkingAllocation"("societyId", "id", "flatId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
