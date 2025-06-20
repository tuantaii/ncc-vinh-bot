-- CreateEnum
CREATE TYPE "ETransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "EMessageRole" AS ENUM ('system', 'user', 'assistant');

-- CreateEnum
CREATE TYPE "ETransactionSendStatus" AS ENUM ('PLAY_BlACK_JACK');

-- CreateEnum
CREATE TYPE "EJackGameStatus" AS ENUM ('WAITING', 'PLAYING', 'ENDED');

-- CreateTable
CREATE TABLE "MessageLogs" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "senderAvatar" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderUsername" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "clanAvatar" TEXT NOT NULL,
    "clanName" TEXT NOT NULL,
    "clanUsername" TEXT NOT NULL,
    "channelLabel" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MessageLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetToken" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBalance" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLogs" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "ETransactionType" NOT NULL DEFAULT 'DEPOSIT',

    CONSTRAINT "TransactionLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionSendLogs" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "toUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT 'kbb',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionSendLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackJackGame" (
    "id" SERIAL NOT NULL,
    "hostId" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "EJackGameStatus" NOT NULL DEFAULT 'WAITING',
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "isPublicChannel" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT '2',
    "remainingCards" INTEGER[],
    "hostCards" INTEGER[],
    "guestCards" INTEGER[],
    "turnOf" TEXT,
    "isHostStand" BOOLEAN NOT NULL DEFAULT false,
    "isGuestStand" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "BlackJackGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackJackGameLogs" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "card" TEXT NOT NULL,

    CONSTRAINT "BlackJackGameLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetToken_userId_key" ON "TimesheetToken"("userId");

-- CreateIndex
CREATE INDEX "UserBalance_userId_idx" ON "UserBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBalance_userId_key" ON "UserBalance"("userId");

-- CreateIndex
CREATE INDEX "TransactionLogs_userId_transactionId_idx" ON "TransactionLogs"("userId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLogs_transactionId_key" ON "TransactionLogs"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionSendLogs_userId_idx" ON "TransactionSendLogs"("userId");
