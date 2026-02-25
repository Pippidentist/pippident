import { db } from "../lib/db";
import { studios, users, treatmentTypes } from "../lib/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database...");

  // Crea studio demo
  const [studio] = await db
    .insert(studios)
    .values({
      name: "Studio Dentistico Demo",
      email: "studio@pippident.demo",
      phone: "+39 02 1234567",
      address: "Via Roma 1, Milano",
      vatNumber: "IT12345678901",
      isActive: true,
    })
    .returning()
    .onConflictDoNothing();

  if (!studio) {
    console.log("⚠️  Studio già esistente, recupero...");
    const existing = await db.select().from(studios).limit(1);
    if (!existing[0]) throw new Error("Impossibile creare lo studio");
    console.log(`✅ Studio esistente: ${existing[0].name} (${existing[0].id})`);
    return;
  }

  console.log(`✅ Studio creato: ${studio.name} (${studio.id})`);

  // Password hash
  const adminPassword = await bcrypt.hash("admin123456", 12);
  const dentistPassword = await bcrypt.hash("dentist123456", 12);
  const secretaryPassword = await bcrypt.hash("secretary123", 12);

  // Crea utenti
  const [admin] = await db
    .insert(users)
    .values({
      studioId: studio.id,
      email: "admin@pippident.demo",
      passwordHash: adminPassword,
      fullName: "Mario Rossi (Admin)",
      role: "admin",
      isActive: true,
    })
    .returning();

  const [dentist] = await db
    .insert(users)
    .values({
      studioId: studio.id,
      email: "dentista@pippident.demo",
      passwordHash: dentistPassword,
      fullName: "Dr. Luigi Bianchi",
      role: "dentist",
      isActive: true,
    })
    .returning();

  const [secretary] = await db
    .insert(users)
    .values({
      studioId: studio.id,
      email: "segreteria@pippident.demo",
      passwordHash: secretaryPassword,
      fullName: "Anna Verdi",
      role: "secretary",
      isActive: true,
    })
    .returning();

  console.log(`✅ Utenti creati: ${admin.email}, ${dentist.email}, ${secretary.email}`);

  // Crea catalogo cure
  await db.insert(treatmentTypes).values([
    {
      studioId: studio.id,
      code: "VIS01",
      name: "Visita di Controllo",
      description: "Visita odontoiatrica di controllo periodica",
      category: "Diagnostica",
      defaultDurationMinutes: 30,
      listPrice: "50.00",
      autoRecallDays: 180,
      isActive: true,
    },
    {
      studioId: studio.id,
      code: "IG01",
      name: "Igiene Professionale",
      description: "Pulizia dentale professionale con ultrasuoni e lucidatura",
      category: "Igiene",
      defaultDurationMinutes: 60,
      listPrice: "80.00",
      autoRecallDays: 180,
      isActive: true,
    },
    {
      studioId: studio.id,
      code: "OTT01",
      name: "Otturazione",
      description: "Otturazione composita diretta",
      category: "Conservativa",
      defaultDurationMinutes: 45,
      listPrice: "120.00",
      autoRecallDays: null,
      isActive: true,
    },
    {
      studioId: studio.id,
      code: "DEV01",
      name: "Devitalizzazione",
      description: "Trattamento canalare monoradicolare",
      category: "Endodonzia",
      defaultDurationMinutes: 90,
      listPrice: "350.00",
      autoRecallDays: null,
      isActive: true,
    },
    {
      studioId: studio.id,
      code: "IMP01",
      name: "Impianto Dentale",
      description: "Inserimento impianto osseointegrato",
      category: "Implantologia",
      defaultDurationMinutes: 120,
      listPrice: "1200.00",
      autoRecallDays: 90,
      isActive: true,
    },
    {
      studioId: studio.id,
      code: "SBI01",
      name: "Sbiancamento Dentale",
      description: "Sbiancamento professionale in studio",
      category: "Estetica",
      defaultDurationMinutes: 90,
      listPrice: "250.00",
      autoRecallDays: 365,
      isActive: true,
    },
    {
      studioId: studio.id,
      code: "PRO01",
      name: "Corona Ceramica",
      description: "Corona protesica in ceramica integrale",
      category: "Protesi",
      defaultDurationMinutes: 60,
      listPrice: "650.00",
      autoRecallDays: null,
      isActive: true,
    },
  ]);

  console.log("✅ Catalogo cure creato");

  console.log("\n🎉 Seed completato!\n");
  console.log("Credenziali di accesso:");
  console.log("  Admin:      admin@pippident.demo / admin123456");
  console.log("  Dentista:   dentista@pippident.demo / dentist123456");
  console.log("  Segreteria: segreteria@pippident.demo / secretary123");
}

seed().catch(console.error).finally(() => process.exit(0));
