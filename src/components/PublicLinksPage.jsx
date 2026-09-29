// src/components/PublicLinksPage.jsx
// Public, unauthenticated page a guest lands on after scanning a
// LINKS_BUNDLE-type QR code (see QrRedirectController's redirect to
// {app.frontend-url}/links/{code} and the matching public
// GET /api/qr-codes/links/{code} in PublicQrLinksController). No login, no
// ProtectedRoute - mirrors GuestCheckInPage's public-route pattern. Actual
// rendering lives in LinksPageContent.jsx, shared with the admin Preview
// modal in QrCodeManager.jsx.
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import config from "../config";
import LinksPageContent from "./LinksPageContent";

const PublicLinksPage = () => {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchBundle = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/qr-codes/links/${code}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setBundle(data);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchBundle();
  }, [code]);

  const pageBackgroundUrl = bundle?.pageBackgroundImageUrl
    ? `${config.BASE_URL}${bundle.pageBackgroundImageUrl}`
    : null;
  const pageLogoUrl = bundle?.pageLogoImageUrl ? `${config.BASE_URL}${bundle.pageLogoImageUrl}` : null;

  return (
    <LinksPageContent
      resortName={bundle?.resortName}
      logoUrl={pageLogoUrl}
      backgroundUrl={pageBackgroundUrl}
      items={bundle?.items || []}
      loading={loading}
      notFound={notFound || !bundle}
    />
  );
};

export default PublicLinksPage;
