import { db } from "@/lib/db";
import { generateToken, getMagicLinkExpiry } from "@/lib/auth";

// Store magic link tokens in the Session table with a special prefix
// This avoids needing a separate MagicLinkToken model
const MAGIC_LINK_PREFIX = "magic_";

export async function createMagicLinkToken(email: string): Promise<string | null> {
  // Find or create user
  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    // Auto-create user on first magic link request (register flow)
    const name = email.split("@")[0];
    user = await db.user.create({
      data: { email, name },
    });
  }

  // Rate limit: max 3 magic links per 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentTokens = await db.session.count({
    where: {
      userId: user.id,
      token: { startsWith: MAGIC_LINK_PREFIX },
      createdAt: { gte: tenMinutesAgo },
    },
  });

  if (recentTokens >= 3) {
    return null; // Rate limited
  }

  const rawToken = generateToken();
  const token = `${MAGIC_LINK_PREFIX}${rawToken}`;

  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: getMagicLinkExpiry(),
    },
  });

  return rawToken;
}

export async function verifyMagicLinkToken(rawToken: string) {
  const token = `${MAGIC_LINK_PREFIX}${rawToken}`;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  // Check expiry
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } });
    return null;
  }

  // Delete the magic link token (one-time use)
  await db.session.delete({ where: { id: session.id } });

  // Mark email as verified
  if (!session.user.emailVerified) {
    await db.user.update({
      where: { id: session.user.id },
      data: { emailVerified: true },
    });
  }

  return session.user;
}
