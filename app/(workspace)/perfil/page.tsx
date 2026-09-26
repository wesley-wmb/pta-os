import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { ProfileForm } from '@/features/profile/profile-form';
import { getOwnProfile } from '@/features/profile/server';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfilePage() {
  const profile = await getOwnProfile();

  return (
    <main id="conteudo-principal" className="pta-page-transition pb-20">
      <PageHeader
        eyebrow="Conta pessoal"
        title="Seu perfil"
        description="Atualize como você aparece para as pessoas com quem trabalha."
        width="reading"
      />
      <div className="mx-auto w-full max-w-[900px] px-4 sm:px-6">
        <ProfileForm profile={profile} />
      </div>
    </main>
  );
}
