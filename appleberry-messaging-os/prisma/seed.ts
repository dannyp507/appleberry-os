import * as argon2 from 'argon2';
import { PrismaClient, GlobalRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash(process.env.DEFAULT_PLATFORM_OWNER_PASSWORD ?? 'ChangeMe123!');

  const starterPlan = await prisma.plan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      code: 'starter',
      name: 'Starter',
      maxWhatsappAccounts: 2,
      maxCampaignsPerMonth: 10,
      maxContacts: 5000,
      maxFlows: 5,
      maxApiRequests: 10000,
      maxMonthlyMessages: 10000,
      features: {
        analytics: 'basic',
        ai: false,
      },
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: process.env.DEFAULT_PLATFORM_OWNER_EMAIL ?? 'owner@appleberry.local' },
    update: {},
    create: {
      email: process.env.DEFAULT_PLATFORM_OWNER_EMAIL ?? 'owner@appleberry.local',
      firstName: 'Appleberry',
      lastName: 'Owner',
      globalRole: GlobalRole.SUPER_ADMIN,
      isPlatformOwner: true,
      passwordHash,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'appleberry-internal' },
    update: {},
    create: {
      name: 'Appleberry Internal',
      slug: 'appleberry-internal',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'internal-ops',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'Internal Ops',
      slug: 'internal-ops',
      timezone: 'Africa/Johannesburg',
      locale: 'en',
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: owner.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: owner.id,
      workspaceId: workspace.id,
      role: GlobalRole.WORKSPACE_OWNER,
    },
  });

  await prisma.subscription.upsert({
    where: { id: `${organization.id}-starter` },
    update: {},
    create: {
      id: `${organization.id}-starter`,
      organizationId: organization.id,
      planId: starterPlan.id,
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
