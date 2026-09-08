import { ArrowUpRight } from "lucide-react";
import { contact, contactChannels } from "../config/contact";

export function ContactDock() {
  return (
    <nav id="contato" className="contact-dock" aria-label="Contatos rápidos">
      <div className="contact-dock-inner">
        <span className="contact-dock-title">
          <i /> Vamos conversar
        </span>
        <div className="contact-dock-links">
          {contactChannels.map(({ label, href, icon: Icon }) => {
            const isWhatsApp = label === "WhatsApp";
            const isEmail = label === "E-mail";
            const isPrimary = href === contact.primaryHref;

            return (
              <a
                key={label}
                href={href}
                className={isPrimary ? "contact-dock-primary" : undefined}
                {...(href.startsWith("http")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                aria-label={label}
              >
                <Icon size={17} />
                {(isWhatsApp || isEmail) && (
                  <span>{isEmail ? contact.email : label}</span>
                )}
                {(isWhatsApp || isEmail) && <ArrowUpRight size={14} />}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
