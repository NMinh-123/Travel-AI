-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('EMAIL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "RiderLevel" AS ENUM ('BEGINNER', 'EXPERIENCED', 'VETERAN', 'EASY_RIDER');

-- CreateEnum
CREATE TYPE "DestinationCategory" AS ENUM ('pass', 'nature', 'culture', 'viewpoint', 'waterfall', 'homestay');

-- CreateEnum
CREATE TYPE "WaypointType" AS ENUM ('city', 'pass', 'scenic', 'water', 'culture');

-- CreateEnum
CREATE TYPE "GearCategory" AS ENUM ('safety', 'clothing', 'electronics', 'medical', 'documents');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "passwordHash" TEXT,
    "provider" "Provider" NOT NULL DEFAULT 'EMAIL',
    "googleId" TEXT,
    "phone" TEXT,
    "riderLevel" "RiderLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItinerary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "totalKm" INTEGER NOT NULL,
    "travelMode" TEXT,
    "vibe" TEXT,
    "budgetLevel" TEXT,
    "days" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vietnameseName" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "category" "DestinationCategory" NOT NULL,
    "elevation" INTEGER NOT NULL,
    "distanceFromStart" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "bestTime" TEXT NOT NULL,
    "highlights" TEXT[],
    "imageUrl" TEXT NOT NULL,
    "gallery" TEXT[],
    "description" TEXT NOT NULL,
    "safetyTip" TEXT NOT NULL,
    "coordX" INTEGER NOT NULL,
    "coordY" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "recommendedStayHours" DOUBLE PRECISION NOT NULL,
    "localFood" TEXT[],
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapWaypoint" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vietnamese" TEXT NOT NULL,
    "km" INTEGER NOT NULL,
    "elevation" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "type" "WaypointType" NOT NULL,
    "warning" TEXT,
    "destinationRef" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MapWaypoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homestay" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "pricePerNight" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "tags" TEXT[],
    "highlight" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Homestay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "GearCategory" NOT NULL,
    "recommended" BOOLEAN NOT NULL,
    "defaultChecked" BOOLEAN NOT NULL,
    "note" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassWeather" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "elevation" INTEGER NOT NULL,
    "temp" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "windSpeedKm" INTEGER NOT NULL,
    "fogLevel" TEXT NOT NULL,
    "roadStatus" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PassWeather_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresetItinerary" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "totalKm" INTEGER NOT NULL,
    "days" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PresetItinerary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_provider_idx" ON "User"("provider");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_destinationSlug_key" ON "Favorite"("userId", "destinationSlug");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_label_key" ON "UserBadge"("userId", "label");

-- CreateIndex
CREATE INDEX "SavedItinerary_userId_createdAt_idx" ON "SavedItinerary"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE INDEX "Destination_category_idx" ON "Destination"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MapWaypoint_slug_key" ON "MapWaypoint"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Homestay_slug_key" ON "Homestay"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GearItem_slug_key" ON "GearItem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PassWeather_slug_key" ON "PassWeather"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PresetItinerary_slug_key" ON "PresetItinerary"("slug");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItinerary" ADD CONSTRAINT "SavedItinerary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

