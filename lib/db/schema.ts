import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── STUDIOS (Tenant) ───────────────────────────────────────────────────────

export const studios = pgTable("studios", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  vatNumber: varchar("vat_number", { length: 20 }),
  logoUrl: text("logo_url"),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 100 }),
  whatsappToken: text("whatsapp_token"),
  settings: jsonb("settings").$type<{
    openingHours?: Record<string, { open: string; close: string }>;
    whatsappTemplates?: Record<string, string>;
    reminderDaysBefore?: number;
  }>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── USERS (Staff dello studio) ─────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  studioId: uuid("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().$type<
    "super_admin" | "admin" | "dentist" | "secretary"
  >(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

// ─── PATIENTS ────────────────────────────────────────────────────────────────

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    fiscalCode: varchar("fiscal_code", { length: 16 }),
    gender: varchar("gender", { length: 10 }).$type<"M" | "F" | "Other">(),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    postalCode: varchar("postal_code", { length: 10 }),
    province: varchar("province", { length: 5 }),
    notes: text("notes"),
    gdprConsent: boolean("gdpr_consent").default(false).notNull(),
    gdprConsentDate: timestamp("gdpr_consent_date", { withTimezone: true }),
    firstVisitDate: date("first_visit_date"),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_patients_studio").on(table.studioId),
    index("idx_patients_phone").on(table.phone),
  ]
);

// ─── TREATMENT TYPES (Catalogo Cure) ─────────────────────────────────────────

export const treatmentTypes = pgTable("treatment_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  studioId: uuid("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  defaultDurationMinutes: integer("default_duration_minutes").default(30).notNull(),
  listPrice: decimal("list_price", { precision: 10, scale: 2 }),
  autoRecallDays: integer("auto_recall_days"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    dentistId: uuid("dentist_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    treatmentTypeId: uuid("treatment_type_id").references(() => treatmentTypes.id, {
      onDelete: "set null",
    }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 50 })
      .notNull()
      .$type<"confirmed" | "pending" | "completed" | "cancelled" | "no_show">(),
    notes: text("notes"),
    reminderSent: boolean("reminder_sent").default(false).notNull(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_appointments_studio_date").on(table.studioId, table.startTime),
    index("idx_appointments_dentist").on(table.dentistId, table.startTime),
  ]
);

// ─── PATIENT TREATMENTS (Storico Cure) ───────────────────────────────────────

export const patientTreatments = pgTable("patient_treatments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studioId: uuid("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "restrict" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  treatmentTypeId: uuid("treatment_type_id")
    .notNull()
    .references(() => treatmentTypes.id, { onDelete: "restrict" }),
  dentistId: uuid("dentist_id").references(() => users.id, { onDelete: "set null" }),
  teeth: text("teeth").array(),
  clinicalNotes: text("clinical_notes"),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 50 })
    .notNull()
    .$type<"planned" | "performed" | "suspended">(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── RECALLS (Richiami) ───────────────────────────────────────────────────────

export const recalls = pgTable(
  "recalls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    treatmentTypeId: uuid("treatment_type_id").references(() => treatmentTypes.id, {
      onDelete: "set null",
    }),
    recallType: varchar("recall_type", { length: 100 }).notNull(),
    dueDate: date("due_date").notNull(),
    status: varchar("status", { length: 50 })
      .notNull()
      .$type<"active" | "sent" | "completed" | "ignored">(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    secondReminderSentAt: timestamp("second_reminder_sent_at", { withTimezone: true }),
    notes: text("notes"),
    createdAutomatically: boolean("created_automatically").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_recalls_due_date").on(table.studioId, table.dueDate, table.status),
  ]
);

// ─── QUOTES (Preventivi) ─────────────────────────────────────────────────────

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  studioId: uuid("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "restrict" }),
  quoteNumber: varchar("quote_number", { length: 50 }).notNull(),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date"),
  status: varchar("status", { length: 50 })
    .notNull()
    .$type<"draft" | "sent" | "accepted" | "rejected" | "expired">(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── QUOTE ITEMS (Voci Preventivo) ───────────────────────────────────────────

export const quoteItems = pgTable("quote_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  treatmentTypeId: uuid("treatment_type_id").references(() => treatmentTypes.id, {
    onDelete: "set null",
  }),
  description: varchar("description", { length: 255 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).default("0").notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// ─── PAYMENTS (Pagamenti) ─────────────────────────────────────────────────────

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    receiptNumber: varchar("receipt_number", { length: 50 }),
    paymentDate: date("payment_date").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).$type<
      "cash" | "card" | "bank_transfer" | "financing"
    >(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_payments_patient").on(table.patientId)]
);

// ─── WHATSAPP MESSAGES ────────────────────────────────────────────────────────

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  studioId: uuid("studio_id")
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
  direction: varchar("direction", { length: 10 }).notNull().$type<"inbound" | "outbound">(),
  messageType: varchar("message_type", { length: 50 }).$type<
    | "reminder"
    | "recall"
    | "quote"
    | "appointment_confirm"
    | "appointment_cancel"
    | "appointment_reschedule"
    | "generic"
  >(),
  body: text("body"),
  status: varchar("status", { length: 50 }).$type<"sent" | "delivered" | "read" | "failed">(),
  waMessageId: varchar("wa_message_id", { length: 255 }),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const studiosRelations = relations(studios, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  treatmentTypes: many(treatmentTypes),
  appointments: many(appointments),
  recalls: many(recalls),
  quotes: many(quotes),
  payments: many(payments),
}));

export const usersRelations = relations(users, ({ one }) => ({
  studio: one(studios, { fields: [users.studioId], references: [studios.id] }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  studio: one(studios, { fields: [patients.studioId], references: [studios.id] }),
  appointments: many(appointments),
  treatments: many(patientTreatments),
  recalls: many(recalls),
  quotes: many(quotes),
  payments: many(payments),
}));

export const treatmentTypesRelations = relations(treatmentTypes, ({ one }) => ({
  studio: one(studios, { fields: [treatmentTypes.studioId], references: [studios.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  studio: one(studios, { fields: [appointments.studioId], references: [studios.id] }),
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  dentist: one(users, { fields: [appointments.dentistId], references: [users.id] }),
  treatmentType: one(treatmentTypes, {
    fields: [appointments.treatmentTypeId],
    references: [treatmentTypes.id],
  }),
}));

export const patientTreatmentsRelations = relations(patientTreatments, ({ one }) => ({
  patient: one(patients, { fields: [patientTreatments.patientId], references: [patients.id] }),
  appointment: one(appointments, {
    fields: [patientTreatments.appointmentId],
    references: [appointments.id],
  }),
  treatmentType: one(treatmentTypes, {
    fields: [patientTreatments.treatmentTypeId],
    references: [treatmentTypes.id],
  }),
  dentist: one(users, { fields: [patientTreatments.dentistId], references: [users.id] }),
}));

export const recallsRelations = relations(recalls, ({ one }) => ({
  patient: one(patients, { fields: [recalls.patientId], references: [patients.id] }),
  treatmentType: one(treatmentTypes, {
    fields: [recalls.treatmentTypeId],
    references: [treatmentTypes.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  patient: one(patients, { fields: [quotes.patientId], references: [patients.id] }),
  items: many(quoteItems),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
  treatmentType: one(treatmentTypes, {
    fields: [quoteItems.treatmentTypeId],
    references: [treatmentTypes.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  patient: one(patients, { fields: [payments.patientId], references: [patients.id] }),
  quote: one(quotes, { fields: [payments.quoteId], references: [quotes.id] }),
  appointment: one(appointments, {
    fields: [payments.appointmentId],
    references: [appointments.id],
  }),
}));

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────────

export type Studio = typeof studios.$inferSelect;
export type NewStudio = typeof studios.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;

export type TreatmentType = typeof treatmentTypes.$inferSelect;
export type NewTreatmentType = typeof treatmentTypes.$inferInsert;

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

export type PatientTreatment = typeof patientTreatments.$inferSelect;
export type NewPatientTreatment = typeof patientTreatments.$inferInsert;

export type Recall = typeof recalls.$inferSelect;
export type NewRecall = typeof recalls.$inferInsert;

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
