# Next.js Server Actions & Incremental Static Regeneration Exemplars

> Extracted verbatim from `registry/agents/subagent-frontend-architect.md` per Plan 025
> Objective 4 (code exemplars live in the skill, not the specialist body). Consulted by
> `subagent-frontend-architect` via its Skill Consultation Map.

## 1. Next.js Server Action with Zod Validation & Cache Revalidation

```typescript
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(2).max(50),
  email: z.string().email(),
});

export type UpdateProfileState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function updateProfileAction(
  prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const rawData = {
    userId: formData.get('userId'),
    displayName: formData.get('displayName'),
    email: formData.get('email'),
  };

  const parsed = UpdateProfileSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // Execute database mutation
  await db.user.update({
    where: { id: parsed.data.userId },
    data: { displayName: parsed.data.displayName, email: parsed.data.email },
  });

  // Deterministic cache invalidation
  revalidateTag(`user-${parsed.data.userId}`);
  revalidatePath('/settings/profile');

  return { success: true, message: 'Profile updated successfully.' };
}
```

## 2. Incremental Static Regeneration (ISR) Route

```typescript
// src/app/products/[slug]/page.tsx
import { notFound } from 'next/navigation';

// Revalidate page cache every 1 hour (3600 seconds)
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const topProducts = await getTopProducts();
  return topProducts.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  return (
    <article className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{product.title}</h1>
      <p className="mt-4 text-muted-foreground">{product.description}</p>
    </article>
  );
}
```
