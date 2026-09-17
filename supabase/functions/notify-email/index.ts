// OPCIONAL — e-mail avisando quando algo acontece.
//
// Como ligar:
//  1. Crie uma conta em https://resend.com e pegue uma API key.
//  2. No Supabase:  supabase functions deploy notify-email --no-verify-jwt
//     (ou cole este código em Edge Functions → New function, pelo painel)
//  3. Supabase → Edge Functions → Secrets:
//       RESEND_API_KEY = re_xxx
//       MAIL_FROM      = APROVA DOPAMINE <avisos@seudominio.com>
//       APP_URL        = https://seuusuario.github.io/aprova/
//  4. Supabase → Database → Webhooks → Create:
//       tabela  public.notifications
//       evento  INSERT
//       tipo    Supabase Edge Function → notify-email
//
// Sem isso o sistema continua funcionando — o aviso só aparece no sininho.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const resendKey = Deno.env.get('RESEND_API_KEY');
const mailFrom = Deno.env.get('MAIL_FROM') ?? 'APROVA DOPAMINE <onboarding@resend.dev>';
const appUrl = Deno.env.get('APP_URL') ?? '';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (!resendKey) return new Response('RESEND_API_KEY ausente', { status: 500 });

  const payload = await req.json();
  const n = payload.record;
  if (!n?.user_id) return new Response('ok');

  const { data: profile } = await admin
    .from('profiles').select('email, full_name').eq('id', n.user_id).maybeSingle();
  if (!profile?.email) return new Response('ok');

  const link = n.asset_id && appUrl ? `${appUrl}#/a/${n.asset_id}` : appUrl;

  // Paleta oficial: paper #F7F3EA, azul-marinho #1E1F5A, vermelho #E30613.
  // Cliente de e-mail não carrega webfont — serifa e sans do sistema fazem o papel
  // de Instrument Serif e Degular.
  const html = `
    <div style="background:#F7F3EA;padding:32px 20px">
      <div style="max-width:520px;margin:0 auto;background:#F7F3EA;color:#1E1F5A">
        <p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:11px;
                  font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#E30613">
          Aprova Dopamine</p>
        <h2 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;
                   font-size:24px;font-weight:800;color:#1E1F5A">${escapeHtml(n.title)}</h2>
        <p style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;
                  font-size:17px;line-height:1.6;color:#1E1F5A">${escapeHtml(n.body ?? '')}</p>
        ${link ? `<a href="${link}"
          style="background:#E30613;color:#F7F3EA;padding:13px 24px;border-radius:4px;
                 font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;
                 text-decoration:none;display:inline-block">Abrir a peça</a>` : ''}
      </div>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFrom,
      to: profile.email,
      subject: n.title,
      html,
    }),
  });

  if (!res.ok) console.error('resend', await res.text());
  return new Response('ok');
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
