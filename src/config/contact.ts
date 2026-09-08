import {
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Youtube,
} from "lucide-react";
import { safeContactLink } from "../../shared/contact-links";

type SocialNetwork = {
  label: string;
  href: string;
  icon: typeof Instagram;
};

const value = (name: string, fallback = "") =>
  (import.meta.env[name] as string | undefined)?.trim() || fallback;

const whatsappNumber = value("VITE_WHATSAPP").replace(/\D/g, "");
const email = value("VITE_CONTACT_EMAIL", "oi@frame.studio");
const whatsappMessage = value(
  "VITE_WHATSAPP_MESSAGE",
  "Olá! Quero conversar sobre um projeto de vídeo.",
);
const emailHref =
  safeContactLink(value("VITE_EMAIL_LINK"), true) ||
  safeContactLink(`mailto:${email}`, true);
const whatsappHref = safeContactLink(
  value(
    "VITE_WHATSAPP_LINK",
    whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
      : "",
  ),
);

export const contact = {
  email,
  emailHref,
  whatsappNumber,
  whatsappHref: whatsappHref || null,
  primaryHref: whatsappHref || emailHref,
  primaryLabel: whatsappHref ? "Conversar pelo WhatsApp" : "Enviar e-mail",
};

export const socialNetworks: SocialNetwork[] = [
  { label: "Instagram", href: value("VITE_INSTAGRAM"), icon: Instagram },
  { label: "LinkedIn", href: value("VITE_LINKEDIN"), icon: Linkedin },
  { label: "YouTube", href: value("VITE_YOUTUBE"), icon: Youtube },
]
  .map((network) => ({ ...network, href: safeContactLink(network.href) }))
  .filter((network) => Boolean(network.href));

export const contactChannels: SocialNetwork[] = [
  ...(contact.whatsappHref
    ? [
        {
          label: "WhatsApp",
          href: contact.whatsappHref,
          icon: MessageCircle,
        },
      ]
    : []),
  ...(contact.emailHref
    ? [{ label: "E-mail", href: contact.emailHref, icon: Mail }]
    : []),
  ...socialNetworks,
];
