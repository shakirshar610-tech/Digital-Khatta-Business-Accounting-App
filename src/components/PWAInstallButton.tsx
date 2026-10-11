import React, { useState } from 'react';
import { Download, MonitorSmartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../types';
import { translations } from '../i18n/translations';

interface PWAInstallButtonProps {
  lang: Language;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const t = translations[lang];

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="min-h-[40px] flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{t.installApp}</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="min-h-[40px] flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <MonitorSmartphone className="w-4 h-4 text-slate-500 shrink-0" />
        <span>{isIOS ? t.installIOS : t.installApp}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 border border-slate-200 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {lang === 'ur'
                  ? 'اینڈرائیڈ اور ونڈوز ڈیسک ٹاپ پر انسٹال کریں'
                  : 'Install on Android & Windows Desktop'}
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {isIOS ? (
                <p>
                  {lang === 'ur'
                    ? 'سفاری براؤزر میں شیئر (Share) بٹن دبائیں اور "Add to Home Screen" منتخب کریں۔'
                    : '1. Tap the Share button in Safari toolbar.\n2. Scroll down and tap "Add to Home Screen".'}
                </p>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {lang === 'ur' ? 'ونڈوز ڈیسک ٹاپ (Chrome / Edge):' : 'Windows Desktop (Chrome / Edge):'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {lang === 'ur'
                        ? 'ایڈریس بار کے دائیں جانب انسٹال آئیکن پر کلک کریں یا نیا ٹیب کھول کر ڈیسک ٹاپ ایپ کے طور پر انسٹال کریں۔'
                        : 'Open the app in a standalone browser tab and click the Install icon in the address bar to pin KarobarKhata Pro to your Windows Taskbar & Start Menu.'}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {lang === 'ur' ? 'اینڈرائیڈ موبائل (Android Chrome):' : 'Android Mobile (Chrome):'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {lang === 'ur'
                        ? 'براؤزر مینو (⋮) کھولیں اور "Install App" یا "Add to Home Screen" پر ٹیپ کریں۔'
                        : 'Tap the browser menu (⋮) and select "Install App" or "Add to Home Screen" for full offline mobile access.'}
                    </p>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {lang === 'ur' ? 'بند کریں' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
