import { useEffect, useState } from "react";
import { Copy, Download, MessageCircle, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ANDROID_APK_FILENAME,
  ANDROID_APK_PATH,
  ANDROID_APK_VERSION,
  androidApkDownloadUrl,
  isRunningInApk,
} from "./model";

export function AndroidDownloadCard({
  variant = "card",
  showQr = false,
  title = "Get Chorepot on Android",
  description = "Install the Chorepot app on your Android phone or your child’s tablet for one-tap access, camera photo proof, and Google sign-in.",
}: {
  variant?: "card" | "compact";
  showQr?: boolean;
  title?: string;
  description?: string;
}) {
  const [inApk, setInApk] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(() => androidApkDownloadUrl());

  useEffect(() => {
    setInApk(isRunningInApk());
    if (typeof window !== "undefined") {
      setDownloadUrl(androidApkDownloadUrl(window.location.origin));
    }
  }, []);

  if (inApk) return null;

  function copyLink() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(downloadUrl)
      .then(() => toast.success("Android app download link copied"));
  }

  if (variant === "compact") {
    return (
      <div className="android-download-compact">
        <div className="min-w-0 flex-1">
          <strong className="flex items-center gap-1.5 text-xs font-extrabold">
            <Smartphone size={14} className="text-primary" /> Android app (v{ANDROID_APK_VERSION})
          </strong>
          <small className="block text-[11px] text-muted-foreground">
            Install directly on phones & children’s tablets.
          </small>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button asChild size="sm" variant="outline">
            <a
              href={ANDROID_APK_PATH}
              download={ANDROID_APK_FILENAME}
              type="application/vnd.android.package-archive"
            >
              <Download size={13} /> Download APK
            </a>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={copyLink}>
            <Copy size={13} /> Copy link
          </Button>
        </div>
      </div>
    );
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Download the Chorepot Android app onto your phone or tablet: ${downloadUrl}`,
  )}`;

  return (
    <div className="android-download-card">
      {showQr && (
        <div className="android-download-qr">
          <QRCodeSVG value={downloadUrl} size={104} />
          <small>Scan on phone or tablet</small>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="android-pill">
            <Smartphone size={13} /> Android App
          </span>
          <span className="text-xs font-bold text-muted-foreground">
            v{ANDROID_APK_VERSION} · Phone & Tablet
          </span>
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="share-buttons mt-3">
          <Button asChild size="sm">
            <a
              href={ANDROID_APK_PATH}
              download={ANDROID_APK_FILENAME}
              type="application/vnd.android.package-archive"
            >
              <Download size={14} /> Download Android APK
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={14} /> Send via WhatsApp
            </a>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={copyLink}>
            <Copy size={14} /> Copy link
          </Button>
        </div>
        <small className="mt-2.5 block text-xs text-muted-foreground">
          Tap the downloaded file on your Android device and allow “Install unknown apps” once if
          prompted.
        </small>
      </div>
    </div>
  );
}
