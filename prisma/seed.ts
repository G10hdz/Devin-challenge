import { PrismaClient } from "@prisma/client";

// ALL DATA BELOW IS OBVIOUSLY FAKE. No real PII, ever.
const prisma = new PrismaClient();

const USERS = [
  { id: "user-analyst-1", name: "Ana Analyst", role: "analyst" },
  { id: "user-analyst-2", name: "Alex Analyst", role: "analyst" },
  { id: "user-approver-1", name: "Pat Approver", role: "approver" },
  { id: "user-approver-2", name: "Robin Approver", role: "approver" },
  { id: "user-admin-1", name: "Sam Admin", role: "admin" },
];

const FAKE_NAMES = [
  "Testy McTestface",
  "Fakey Fakerson",
  "Demo Dummyson",
  "Sample Samuelson",
  "Placeholder Pérez",
  "Mocky Mockington",
  "Notreal Nolastname",
  "Example Exampleton",
  "Dummy Dumberson",
  "Fixture Fakewell",
  "Synthetic Sanchez",
  "Bogus Buenrostro",
  "Pretend Prieto",
  "Stub Stubbins",
  "Lorem Ipsumovich",
  "Faux Fauxman",
  "Testcase Torres",
  "Sandbox Sandoval",
  "Nonreal Nuñez",
  "Imaginary Ibarra",
  "Placeholder Plunkett",
  "Simulated Silva",
  "Fabricated Farias",
  "Hypothetical Huerta",
  "Counterfeit Castillo",
];

const STATUSES = ["pending", "in_review", "approved", "rejected"] as const;
const COUNTRIES = ["Testlandia", "Fakeland", "Mockovia", "Sampleston"];

async function main() {
  await prisma.case.deleteMany();
  await prisma.user.deleteMany();
  // Audit rows are append-only and cannot be deleted; the seed leaves them alone.
  await prisma.user.createMany({ data: USERS });

  const analysts = USERS.filter((u) => u.role === "analyst");
  const approvers = USERS.filter((u) => u.role === "approver");

  for (let i = 0; i < FAKE_NAMES.length; i++) {
    const status = STATUSES[i % STATUSES.length];
    const analyst = analysts[i % analysts.length];
    const approver = approvers[i % approvers.length];
    const decided = status === "approved" || status === "rejected";

    await prisma.case.create({
      data: {
        reference: `KYC-FAKE-${String(1000 + i)}`,
        applicantName: FAKE_NAMES[i],
        status,
        country: COUNTRIES[i % COUNTRIES.length],
        riskScore: 10 + ((i * 7) % 90),
        assigneeId: status === "pending" ? null : analyst.id,
        movedToReviewById: status === "pending" ? null : analyst.id,
        taxId: `FAKE-TAX-${String(900000 + i)}`,
        documentNumber: `FAKE-DOC-${String(770000 + i)}`,
        dateOfBirth: `1990-01-${String((i % 28) + 1).padStart(2, "0")}`,
        email: `fake.applicant${i}@example.invalid`,
        phone: `+1-555-01${String(i).padStart(2, "0")}`,
        address: `${100 + i} Fake Street, Testlandia`,
        decisionReason: decided
          ? `Seeded decision: ${status} for demo purposes`
          : null,
        decidedById: decided ? approver.id : null,
      },
    });
  }

  console.log(`Seeded ${USERS.length} users and ${FAKE_NAMES.length} fake cases.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
