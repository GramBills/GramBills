import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  QrCode,
  Save,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import type {
  PrintSize,
  ShopSettings,
  ShopSettingsForm,
} from '../../types/pos';
import {
  downloadBackup,
  getLastBackupAt,
  restoreBackupFromFile,
} from '../../db/backup';
import { formatDateTime } from '../../lib/date';
import { cn } from '../../lib/cn';
import { formatBytes } from '../../lib/format';
import { formatInvoiceNumber } from '../../lib/invoiceNumber';
import { buildUpiUri } from '../../lib/upi';
import { validateShopForm, type ShopFormErrors } from '../../lib/validation';
import { useTranslation } from '../../i18n/useTranslation';
import { updateShopSettings } from '../../services/settings';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui/primitives';

interface ShopSettingsViewProps {
  settings: ShopSettings;
}

interface StorageState {
  supported: boolean;
  persisted: boolean;
  usage: number;
  quota: number;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function toForm(settings: ShopSettings): ShopSettingsForm {
  return {
    shopName: settings.shopName,
    ownerName: settings.ownerName,
    phone: settings.phone,
    address: settings.address,
    gstin: settings.gstin,
    upiId: settings.upiId,
    upiPayeeName: settings.upiPayeeName,
    invoicePrefix: settings.invoicePrefix,
    defaultPrintSize: settings.defaultPrintSize,
    termsAndConditions: settings.termsAndConditions,
  };
}

export function ShopSettingsView({ settings }: ShopSettingsViewProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ShopSettingsForm>(() => toForm(settings));
  const [errors, setErrors] = useState<ShopFormErrors>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(() =>
    getLastBackupAt(),
  );
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [storage, setStorage] = useState<StorageState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upiUri = useMemo(() => {
    const upiId = form.upiId.trim();
    const payee = form.upiPayeeName.trim();
    if (!upiId || !payee) {
      return '';
    }
    return buildUpiUri({
      pa: upiId,
      pn: payee,
      am: 1,
      tn: 'GramBill test payment',
    });
  }, [form.upiId, form.upiPayeeName]);

  const nextInvoiceDisplay = formatInvoiceNumber(
    form.invoicePrefix,
    settings.nextInvoiceNumber,
  );

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    if (!upiUri) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(upiUri, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl('');
        }
      });
    return () => {
      active = false;
    };
  }, [upiUri]);

  const refreshStorage = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.storage) {
      setStorage({
        supported: false,
        persisted: false,
        usage: 0,
        quota: 0,
      });
      return;
    }
    const persisted = await navigator.storage.persisted();
    const estimate = await navigator.storage.estimate();
    setStorage({
      supported: true,
      persisted,
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    });
  }, []);

  useEffect(() => {
    void refreshStorage();
  }, [refreshStorage]);

  function updateField<K extends keyof ShopSettingsForm>(
    key: K,
    value: ShopSettingsForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateShopForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setToast({
        type: 'error',
        message: 'Please fix the highlighted fields.',
      });
      return;
    }

    const cleaned: ShopSettingsForm = {
      ...form,
      shopName: form.shopName.trim(),
      ownerName: form.ownerName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      upiId: form.upiId.trim(),
      upiPayeeName: form.upiPayeeName.trim(),
      invoicePrefix: form.invoicePrefix.trim(),
      termsAndConditions: form.termsAndConditions.trim(),
    };

    setSaveState('saving');
    try {
      await updateShopSettings(cleaned);
      setForm(cleaned);
      setToast({ type: 'success', message: t('settings.saved') });
    } catch (error) {
      setToast({
        type: 'error',
        message:
          error instanceof Error ? error.message : t('settings.saveFailed'),
      });
    } finally {
      setSaveState('idle');
    }
  }

  async function handleDownloadBackup() {
    setBackupBusy(true);
    try {
      const payload = await downloadBackup();
      setLastBackup(payload.exportedAt);
      setToast({ type: 'success', message: 'Backup downloaded.' });
    } catch (error) {
      setToast({
        type: 'error',
        message:
          error instanceof Error ? error.message : t('settings.backupFailed'),
      });
    } finally {
      setBackupBusy(false);
    }
  }

  function handleRestoreClick() {
    fileInputRef.current?.click();
  }

  async function handleRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!window.confirm(t('settings.restoreConfirm'))) {
      return;
    }

    setBackupBusy(true);
    try {
      await restoreBackupFromFile(file);
      setToast({ type: 'success', message: t('settings.restoreSuccess') });
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setToast({
        type: 'error',
        message:
          error instanceof Error ? error.message : t('settings.restoreFailed'),
      });
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRequestPersistence() {
    if (!navigator.storage?.persist) {
      return;
    }
    const granted = await navigator.storage.persist();
    setToast({
      type: granted ? 'success' : 'error',
      message: granted
        ? t('settings.persistenceGranted')
        : t('settings.persistenceDenied'),
    });
    await refreshStorage();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        eyebrow="Setup"
        title={t('settings.title')}
        description={t('settings.subtitle')}
        actions={
          <Button type="submit" disabled={saveState === 'saving'}>
            {saveState === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveState === 'saving'
              ? t('settings.saving')
              : t('settings.save')}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {t('settings.identity')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.identityHint')}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label={t('settings.shopName')}
              htmlFor="shopName"
              required
              error={errors.shopName}
            >
              <Input
                id="shopName"
                value={form.shopName}
                onChange={(event) =>
                  updateField('shopName', event.target.value)
                }
                placeholder="Shree Electronics & Electricals"
              />
            </Field>

            <Field
              label={t('settings.ownerName')}
              htmlFor="ownerName"
              required
              error={errors.ownerName}
            >
              <Input
                id="ownerName"
                value={form.ownerName}
                onChange={(event) =>
                  updateField('ownerName', event.target.value)
                }
                placeholder="Rakesh Kumar"
              />
            </Field>

            <Field
              label={t('settings.phone')}
              htmlFor="phone"
              required
              error={errors.phone}
            >
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) =>
                  updateField('phone', event.target.value)
                }
                inputMode="numeric"
                maxLength={10}
                placeholder="9876500000"
              />
            </Field>

            <Field
              label={t('settings.gstin')}
              htmlFor="gstin"
              hint={t('settings.optional')}
              error={errors.gstin}
            >
              <Input
                id="gstin"
                value={form.gstin}
                onChange={(event) =>
                  updateField('gstin', event.target.value.toUpperCase())
                }
                maxLength={15}
                placeholder="09ABCDE1234F1Z5"
              />
            </Field>

            <Field
              label={t('settings.address')}
              htmlFor="address"
              required
              error={errors.address}
              className="sm:col-span-2"
            >
              <Textarea
                id="address"
                value={form.address}
                onChange={(event) =>
                  updateField('address', event.target.value)
                }
                rows={2}
                placeholder="Main Market, Village/Town, District, State - PIN"
              />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {t('settings.payments')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.paymentsHint')}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label={t('settings.upiId')}
              htmlFor="upiId"
              hint={t('settings.optional')}
              error={errors.upiId}
            >
              <Input
                id="upiId"
                value={form.upiId}
                onChange={(event) =>
                  updateField('upiId', event.target.value)
                }
                placeholder="shopowner@okaxis"
              />
            </Field>

            <Field
              label={t('settings.upiPayeeName')}
              htmlFor="upiPayeeName"
              error={errors.upiPayeeName}
            >
              <Input
                id="upiPayeeName"
                value={form.upiPayeeName}
                onChange={(event) =>
                  updateField('upiPayeeName', event.target.value)
                }
                placeholder="Shree Electronics"
              />
            </Field>

            <Field
              label={t('settings.invoicePrefix')}
              htmlFor="invoicePrefix"
              required
              error={errors.invoicePrefix}
            >
              <Input
                id="invoicePrefix"
                value={form.invoicePrefix}
                onChange={(event) =>
                  updateField('invoicePrefix', event.target.value)
                }
                placeholder="INV-2026-"
              />
            </Field>

            <Field
              label={t('settings.nextInvoice')}
              htmlFor="nextInvoice"
              hint={t('settings.readOnly')}
            >
              <Input
                id="nextInvoice"
                value={nextInvoiceDisplay}
                readOnly
                className="bg-slate-50 font-mono text-slate-600"
              />
            </Field>

            <Field
              label={t('settings.printSize')}
              htmlFor="defaultPrintSize"
              className="sm:col-span-2"
              error={errors.defaultPrintSize}
            >
              <Select
                id="defaultPrintSize"
                value={form.defaultPrintSize}
                onChange={(event) =>
                  updateField(
                    'defaultPrintSize',
                    event.target.value as PrintSize,
                  )
                }
              >
                <option value="thermal_80mm">{t('settings.print80')}</option>
                <option value="thermal_58mm">{t('settings.print58')}</option>
                <option value="a4">{t('settings.printA4')}</option>
                <option value="a5">{t('settings.printA5')}</option>
              </Select>
            </Field>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-[148px] w-[148px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="UPI QR preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <QrCode className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {t('settings.qrTitle')}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {upiUri ? t('settings.qrHint') : t('settings.qrMissing')}
                </p>
                {form.upiId ? (
                  <p className="mt-2 break-all text-xs font-medium text-slate-700">
                    {form.upiId}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {t('settings.terms')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.termsHint')}
          </p>
          <Field
            label={t('settings.terms')}
            htmlFor="termsAndConditions"
            className="mt-5"
          >
            <Textarea
              id="termsAndConditions"
              value={form.termsAndConditions}
              onChange={(event) =>
                updateField('termsAndConditions', event.target.value)
              }
              rows={6}
            />
          </Field>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {t('settings.backupTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('settings.backupHint')}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('settings.lastBackup')}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {lastBackup
                  ? formatDateTime(lastBackup)
                  : t('settings.never')}
              </p>
            </div>
            {lastBackup ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                JSON
              </Badge>
            ) : (
              <Badge variant="warning">
                <XCircle className="h-3.5 w-3.5" />
                {t('settings.never')}
              </Badge>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void handleDownloadBackup()}
              disabled={backupBusy}
              className="sm:flex-1"
            >
              {backupBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('settings.downloadBackup')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleRestoreClick}
              disabled={backupBusy}
              className="sm:flex-1"
            >
              <Upload className="h-4 w-4" />
              {t('settings.restoreBackup')}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleRestoreFile(event)}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {t('settings.restoreNote')}
          </p>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t('settings.storageTitle')}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {t('settings.storageHint')}
                </p>
              </div>
              {storage ? (
                <Badge
                  variant={
                    !storage.supported
                      ? 'neutral'
                      : storage.persisted
                        ? 'success'
                        : 'warning'
                  }
                >
                  {!storage.supported
                    ? t('settings.storageUnsupported')
                    : storage.persisted
                      ? t('settings.storageProtected')
                      : t('settings.storageNotProtected')}
                </Badge>
              ) : null}
            </div>

            {storage?.supported ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium text-slate-500">
                      {t('settings.storageUsage')}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatBytes(storage.usage)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium text-slate-500">
                      {t('settings.storageQuota')}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatBytes(storage.quota)}
                    </p>
                  </div>
                </div>
                {!storage.persisted ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => void handleRequestPersistence()}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {t('settings.requestPersistence')}
                  </Button>
                ) : null}
              </>
            ) : null}

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <HardDrive className="h-4 w-4 text-slate-400" />
              <span>{t('status.dataLocal')}</span>
            </div>
          </div>
        </Card>
      </div>

      {toast ? (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
            toast.type === 'success'
              ? 'bg-emerald-700 text-white'
              : 'bg-rose-600 text-white',
          )}
          role="status"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      ) : null}
    </form>
  );
}
