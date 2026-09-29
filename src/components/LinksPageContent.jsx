// src/components/LinksPageContent.jsx
// Shared presentational rendering for the Links Page - used by
// PublicLinksPage.jsx (the real page a guest lands on) AND by
// QrCodeManager.jsx's Preview modal (so admins see exactly what guests will
// see, with zero risk of the two drifting out of sync).
import React from "react";
import {
  FaMapMarkedAlt,
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaGoogle,
  FaStar,
  FaGlobe,
  FaUtensils,
  FaPhoneAlt,
  FaEnvelope,
  FaYoutube,
  FaTwitter,
  FaLink,
} from "react-icons/fa";
import logo from "../assets/logo-icon.png";
import "./PublicLinksPage.css";

// Matched by substring against the link's own label (case-insensitive) -
// labels are free text (not a fixed type), so this is a best-effort
// recognition, not a strict enum. First match wins, falls back to a plain
// link icon.
const ICON_RULES = [
  [/google\s*maps|\bmaps\b|location|direction/i, FaMapMarkedAlt],
  [/whats\s*app/i, FaWhatsapp],
  [/instagram|\binsta\b/i, FaInstagram],
  [/facebook|\bfb\b/i, FaFacebook],
  [/\bgoogle\b/i, FaGoogle],
  [/review/i, FaStar],
  [/menu|food|restaurant/i, FaUtensils],
  [/phone|call/i, FaPhoneAlt],
  [/email|mail/i, FaEnvelope],
  [/youtube/i, FaYoutube],
  [/twitter|\bx\b/i, FaTwitter],
  [/website|site/i, FaGlobe],
];

const getLinkIcon = (label) => {
  const rule = ICON_RULES.find(([pattern]) => pattern.test(label || ""));
  return rule ? rule[1] : FaLink;
};

const LinksPageContent = ({
  resortName,
  logoUrl,
  backgroundUrl,
  items = [],
  loading = false,
  notFound = false,
  wrapperStyle,
}) => {
  const style = {
    ...(backgroundUrl
      ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
      : {}),
    ...wrapperStyle,
  };

  return (
    <div className="public-links-page" style={style}>
      <div className="public-links-card">
        <img src={logoUrl || logo} alt="" className="public-links-logo" />

        {loading ? (
          <p className="public-links-status">Loading...</p>
        ) : notFound ? (
          <p className="public-links-status">This link is no longer available.</p>
        ) : items.length === 0 ? (
          <>
            <h1>{resortName || "Resort Name"}</h1>
            <p className="public-links-status">No links added yet.</p>
          </>
        ) : (
          <>
            <h1>{resortName}</h1>
            <div className="public-links-list">
              {items.map((item, idx) => {
                const Icon = getLinkIcon(item.label);
                return (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-links-item"
                  >
                    <Icon className="public-links-item-icon" />
                    {item.label}
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LinksPageContent;
