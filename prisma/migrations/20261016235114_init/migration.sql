-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('ENTREPRISE', 'PARTICULIER', 'PARTENAIRE');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('COMPTANT', 'A_TERME');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('CAMION', 'PELLE_HYDRAULIQUE', 'CHARGEUR_TRACTOPELLE', 'BULLDOZER', 'MINI_PELLE_COMPACTEUR');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('DISPONIBLE', 'EN_LOCATION', 'MAINTENANCE', 'VENDU');

-- CreateEnum
CREATE TYPE "MeterUnit" AS ENUM ('HEURES', 'KM');

-- CreateEnum
CREATE TYPE "PartFamily" AS ENUM ('MOTEUR', 'HYDRAULIQUE', 'FILTRATION', 'ELECTRICITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "PartCondition" AS ENUM ('NEUF', 'OCCASION');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "RentalPricing" AS ENUM ('JOURNALIER', 'ROTATION');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('TERRASSEMENT_MASSE', 'DECAPAGE', 'FOUILLES_PROFONDES', 'FOUILLES_TRANCHEES', 'ENROCHEMENT_REMBLAYAGE', 'ASSAINISSEMENT', 'FONDATIONS');

-- CreateEnum
CREATE TYPE "WorksitePricing" AS ENUM ('FORFAIT', 'VOLUME', 'HORAIRE', 'JOURNEE');

-- CreateEnum
CREATE TYPE "WorksiteStatus" AS ENUM ('PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PROFORMA', 'ACOMPTE', 'DEFINITIVE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('A_VALIDER', 'CONVERTIE', 'IMPAYEE', 'PARTIELLE', 'PAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "InvoiceCategory" AS ENUM ('LOCATION', 'CHANTIER', 'VENTE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ESPECES', 'WAVE', 'ORANGE_MONEY');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('TELEPHONE', 'WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "MaintenanceKind" AS ENUM ('INTERNE', 'REPARATION_CLIENT', 'SAV');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ENTRETIEN_PERIODIQUE', 'VIDANGE', 'REPARATION_MECANIQUE', 'HYDRAULIQUE', 'ELECTRICITE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('LOCATION', 'TRAVAUX', 'ACHAT', 'PIECE', 'CONTACT');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NOUVELLE', 'EN_COURS', 'TRAITEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'ENTREPRISE',
    "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'COMPTANT',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "ninea" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "year" INTEGER,
    "serialNumber" TEXT,
    "meterValue" INTEGER NOT NULL DEFAULT 0,
    "meterUnit" "MeterUnit" NOT NULL DEFAULT 'HEURES',
    "powerHp" INTEGER,
    "location" TEXT NOT NULL DEFAULT 'Dakar',
    "description" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "isRentable" BOOLEAN NOT NULL DEFAULT true,
    "dailyRate" INTEGER,
    "rotationRate" INTEGER,
    "degressiveFromDays" INTEGER NOT NULL DEFAULT 7,
    "degressiveDailyRate" INTEGER,
    "isForSale" BOOLEAN NOT NULL DEFAULT false,
    "salePrice" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "family" "PartFamily" NOT NULL,
    "oemReference" TEXT,
    "compatibleModels" TEXT[],
    "condition" "PartCondition" NOT NULL DEFAULT 'NEUF',
    "isOriginal" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 2,
    "warrantyMonths" INTEGER,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentId" TEXT,
    "partId" TEXT,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "pricing" "RentalPricing" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "isDegressive" BOOLEAN NOT NULL DEFAULT false,
    "siteLocation" TEXT,
    "operatorName" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worksite" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "workType" "WorkType" NOT NULL,
    "pricing" "WorksitePricing" NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "estimatedQuantity" DOUBLE PRECISION,
    "budget" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "WorksiteStatus" NOT NULL DEFAULT 'PLANIFIE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worksite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorksiteEntry" (
    "id" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "equipmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorksiteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "category" "InvoiceCategory" NOT NULL,
    "customerId" TEXT NOT NULL,
    "reservationId" TEXT,
    "worksiteId" TEXT,
    "issueDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxRate" INTEGER NOT NULL DEFAULT 18,
    "taxAmount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "partId" TEXT,
    "equipmentId" TEXT,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "transactionRef" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReminder" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "note" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PLANIFIEE',
    "equipmentId" TEXT,
    "customerId" TEXT,
    "externalMachine" TEXT,
    "scheduledDate" DATE NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "technician" TEXT,
    "meterReading" INTEGER,
    "estimatedCost" INTEGER,
    "actualCost" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "InquiryType" NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NOUVELLE',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "desiredStartDate" DATE,
    "durationRange" TEXT,
    "siteLocation" TEXT,
    "productLabel" TEXT,
    "equipmentId" TEXT,
    "partId" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_serialNumber_key" ON "Equipment"("serialNumber");

-- CreateIndex
CREATE INDEX "Equipment_category_status_idx" ON "Equipment"("category", "status");

-- CreateIndex
CREATE INDEX "Equipment_brand_idx" ON "Equipment"("brand");

-- CreateIndex
CREATE INDEX "Part_brand_idx" ON "Part"("brand");

-- CreateIndex
CREATE INDEX "Part_family_idx" ON "Part"("family");

-- CreateIndex
CREATE INDEX "Part_oemReference_idx" ON "Part"("oemReference");

-- CreateIndex
CREATE INDEX "Image_equipmentId_idx" ON "Image"("equipmentId");

-- CreateIndex
CREATE INDEX "Image_partId_idx" ON "Image"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_reference_key" ON "Reservation"("reference");

-- CreateIndex
CREATE INDEX "Reservation_equipmentId_startDate_endDate_idx" ON "Reservation"("equipmentId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Reservation_customerId_idx" ON "Reservation"("customerId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Worksite_reference_key" ON "Worksite"("reference");

-- CreateIndex
CREATE INDEX "Worksite_customerId_idx" ON "Worksite"("customerId");

-- CreateIndex
CREATE INDEX "Worksite_status_idx" ON "Worksite"("status");

-- CreateIndex
CREATE INDEX "WorksiteEntry_worksiteId_date_idx" ON "WorksiteEntry"("worksiteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_reservationId_idx" ON "Invoice"("reservationId");

-- CreateIndex
CREATE INDEX "Invoice_worksiteId_idx" ON "Invoice"("worksiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "InvoiceReminder_invoiceId_idx" ON "InvoiceReminder"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceOrder_reference_key" ON "MaintenanceOrder"("reference");

-- CreateIndex
CREATE INDEX "MaintenanceOrder_status_scheduledDate_idx" ON "MaintenanceOrder"("status", "scheduledDate");

-- CreateIndex
CREATE INDEX "MaintenanceOrder_equipmentId_idx" ON "MaintenanceOrder"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_reference_key" ON "Inquiry"("reference");

-- CreateIndex
CREATE INDEX "Inquiry_status_createdAt_idx" ON "Inquiry"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worksite" ADD CONSTRAINT "Worksite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorksiteEntry" ADD CONSTRAINT "WorksiteEntry_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorksiteEntry" ADD CONSTRAINT "WorksiteEntry_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
