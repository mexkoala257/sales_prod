import React, { useEffect, useState } from 'react';
import { useGetPlatformSettings, useUpdatePlatformSettings, useTestSmtpEmail } from '@workspace/api-client-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, Send, Settings as SettingsIcon } from 'lucide-react';
import type { PlatformSetting } from '@workspace/api-client-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MASK = '••••••••';

function settingsToMap(settings: PlatformSetting[]): Record<string, string> {
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  isSecret?: boolean;
  type?: string;
  placeholder?: string;
}

function SettingField({ id, label, description, value, onChange, isSecret, type = 'text', placeholder }: FieldProps) {
  const [revealed, setRevealed] = useState(false);

  const isMasked = isSecret && value === MASK;
  const inputType = isSecret && !revealed ? 'password' : type;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (isSecret && !revealed) setRevealed(true);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          value={isMasked && !revealed ? MASK : value}
          onChange={handleChange}
          placeholder={placeholder}
          onFocus={() => { if (isMasked) { onChange(''); setRevealed(true); } }}
          className="pr-10"
        />
        {isSecret && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setRevealed((r) => !r); }}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

interface ToggleFieldProps {
  id: string;
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleField({ id, label, description, value, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
      />
      <div>
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  footer?: React.ReactNode;
}

function SectionCard({ title, description, children, onSave, saving, footer }: SectionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="flex items-center gap-3 pt-2 border-t">
          <Button size="sm" onClick={onSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {footer}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading, refetch } = useGetPlatformSettings();
  const updateSettings = useUpdatePlatformSettings();
  const testEmail = useTestSmtpEmail();

  const [values, setValues] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setValues(settingsToMap(settings));
  }, [settings]);

  const set = (key: string) => (v: string) => setValues((prev) => ({ ...prev, [key]: v }));
  const setFlag = (key: string) => (v: boolean) =>
    setValues((prev) => ({ ...prev, [key]: v ? 'true' : 'false' }));

  const getBool = (key: string, def = true) => {
    const v = values[key];
    if (v === undefined) return def;
    return v !== 'false';
  };

  async function saveSection(
    section: string,
    keys: Array<{ key: string; isSecret?: boolean }>,
  ) {
    setSavingSection(section);
    const inputSettings = keys
      .filter(({ key, isSecret }) => {
        const v = values[key];
        // Skip secrets that are still masked (user never edited them)
        if (isSecret && v === MASK) return false;
        return v !== undefined;
      })
      .map(({ key, isSecret }) => ({ key, value: values[key] ?? '', isSecret: isSecret ?? false }));

    try {
      await updateSettings.mutateAsync({ data: { settings: inputSettings } });
      toast({ title: 'Saved', description: `${section} settings updated.` });
      refetch();
    } catch (err: unknown) {
      toast({ title: 'Save failed', description: (err as Error).message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSavingSection(null);
    }
  }

  async function handleTestEmail() {
    try {
      const result = await testEmail.mutateAsync();
      toast({
        title: result.success ? 'Test passed' : 'Test failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (err: unknown) {
      toast({ title: 'Test failed', description: (err as Error).message, variant: 'destructive' });
    }
  }

  if (isLoading) {
    return <div className="animate-pulse font-mono text-sm text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure runtime platform behaviour. Changes take effect within 30 seconds.
        </p>
      </div>

      {/* Platform Identity */}
      <SectionCard
        title="Platform Identity"
        description="Public-facing name, logo, and support contact for this platform instance."
        onSave={() => saveSection('Identity', [
          { key: 'platformName' },
          { key: 'platformSupportEmail' },
          { key: 'platformLogoUrl' },
        ])}
        saving={savingSection === 'Identity'}
      >
        <SettingField id="platformName" label="Platform Name" placeholder="My Wholesale Platform"
          value={values['platformName'] ?? ''} onChange={set('platformName')} />
        <SettingField id="platformSupportEmail" label="Support Email" placeholder="support@example.com"
          value={values['platformSupportEmail'] ?? ''} onChange={set('platformSupportEmail')} />
        <SettingField id="platformLogoUrl" label="Logo URL" placeholder="https://cdn.example.com/logo.svg"
          value={values['platformLogoUrl'] ?? ''} onChange={set('platformLogoUrl')} />
      </SectionCard>

      {/* Object Storage */}
      <SectionCard
        title="Object Storage"
        description="Replit Object Storage bucket paths. Changes take effect on the next upload or download request."
        onSave={() => saveSection('Object Storage', [
          { key: 'objectStoragePrivateDir' },
          { key: 'objectStoragePublicPaths' },
        ])}
        saving={savingSection === 'Object Storage'}
      >
        <SettingField
          id="objectStoragePrivateDir"
          label="Private Upload Directory"
          placeholder="my-bucket/uploads/private"
          description="Bucket path prefix for private artwork uploads."
          value={values['objectStoragePrivateDir'] ?? ''}
          onChange={set('objectStoragePrivateDir')}
        />
        <SettingField
          id="objectStoragePublicPaths"
          label="Public Search Paths"
          placeholder="my-bucket/public, my-bucket/shared"
          description="Comma-separated bucket paths searched when serving public objects."
          value={values['objectStoragePublicPaths'] ?? ''}
          onChange={set('objectStoragePublicPaths')}
        />
      </SectionCard>

      {/* Email / SMTP */}
      <SectionCard
        title="Email (SMTP)"
        description="Outbound email server configuration for transactional messages."
        onSave={() => saveSection('SMTP', [
          { key: 'smtpHost' },
          { key: 'smtpPort' },
          { key: 'smtpUser' },
          { key: 'smtpPassword', isSecret: true },
          { key: 'smtpFromAddress' },
        ])}
        saving={savingSection === 'SMTP'}
        footer={
          <Button variant="outline" size="sm" onClick={handleTestEmail} disabled={testEmail.isPending}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {testEmail.isPending ? 'Sending…' : 'Send test email'}
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <SettingField id="smtpHost" label="SMTP Host" placeholder="smtp.mailgun.org"
              value={values['smtpHost'] ?? ''} onChange={set('smtpHost')} />
          </div>
          <SettingField id="smtpPort" label="Port" placeholder="587"
            value={values['smtpPort'] ?? ''} onChange={set('smtpPort')} />
        </div>
        <SettingField id="smtpUser" label="Username" placeholder="postmaster@example.com"
          value={values['smtpUser'] ?? ''} onChange={set('smtpUser')} />
        <SettingField id="smtpPassword" label="Password" isSecret
          value={values['smtpPassword'] ?? ''} onChange={set('smtpPassword')} />
        <SettingField id="smtpFromAddress" label="From Address" placeholder="no-reply@example.com"
          value={values['smtpFromAddress'] ?? ''} onChange={set('smtpFromAddress')} />
      </SectionCard>

      {/* Security */}
      <SectionCard
        title="Security"
        description="Session and CORS configuration."
        onSave={() => saveSection('Security', [
          { key: 'sessionTimeoutMinutes' },
          { key: 'corsAllowedOrigins' },
        ])}
        saving={savingSection === 'Security'}
      >
        <SettingField id="sessionTimeoutMinutes" label="Session Timeout (minutes)" placeholder="1440"
          description="How long a JWT token remains valid. Requires re-login to take effect."
          type="number" value={values['sessionTimeoutMinutes'] ?? ''} onChange={set('sessionTimeoutMinutes')} />
        <SettingField id="corsAllowedOrigins" label="Allowed CORS Origins" placeholder="https://app.example.com, https://admin.example.com"
          description="Comma-separated list of origins permitted to call the API."
          value={values['corsAllowedOrigins'] ?? ''} onChange={set('corsAllowedOrigins')} />
      </SectionCard>

      {/* Feature Flags */}
      <SectionCard
        title="Feature Flags"
        description="Toggle major platform features without a server restart."
        onSave={() => saveSection('Features', [
          { key: 'featureB2BPortal' },
          { key: 'featureB2CStorefront' },
          { key: 'featureArtworkUploads' },
        ])}
        saving={savingSection === 'Features'}
      >
        <ToggleField
          id="featureB2BPortal"
          label="B2B Wholesale Portal"
          description="Allow B2B buyers to log in and place wholesale orders."
          value={getBool('featureB2BPortal')}
          onChange={setFlag('featureB2BPortal')}
        />
        <ToggleField
          id="featureB2CStorefront"
          label="B2C Public Storefront"
          description="Show public product listings and allow retail orders."
          value={getBool('featureB2CStorefront')}
          onChange={setFlag('featureB2CStorefront')}
        />
        <ToggleField
          id="featureArtworkUploads"
          label="Artwork Uploads (Replit only)"
          description="Enable B2B buyers to upload and attach artwork files. Requires Replit Object Storage."
          value={getBool('featureArtworkUploads')}
          onChange={setFlag('featureArtworkUploads')}
        />
      </SectionCard>
    </div>
  );
}
