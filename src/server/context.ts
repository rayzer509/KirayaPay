import { prisma } from '@/lib/prisma';
import { createSupabaseServerClientFromRequest } from '@/lib/supabase-server';
import type { User } from '@prisma/client';

export interface Context {
  prisma: typeof prisma;
  user: User | null;
}

export async function createContext(req: Request): Promise<Context> {
  try {
    const supabase = createSupabaseServerClientFromRequest(req);
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return { prisma, user: null };

    const user = await prisma.user.findFirst({
      where: { id: authUser.id, deleted_at: null },
    });

    return { prisma, user };
  } catch {
    return { prisma, user: null };
  }
}
