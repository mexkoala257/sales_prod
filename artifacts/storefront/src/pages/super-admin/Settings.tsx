import React, { useEffect, useState } from 'react';
import {
  useGetPlatformSettings, useUpdatePlatformSettings, useTestSmtpEmail,
  useListShopifyCollections, useUpdateShopifyMappings, useRunShopifySync, useGetShopifySyncStatus,
  startShopifyOAuth, useGetShopifyOAuthStatus, useDisconnectShopifyOAuth,
  useListStores,
} from '@workspace/api-client-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, Send, Settings as SettingsIcon, RefreshCw, Store, Link2, Link2Off, CheckCircle2, AlertCircle } from 'lucide-react';
import type { PlatformSetting } from '@workspace/api-client-react';
import { useSearch } from 'wouter';

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

// ── Shopify connection (OAuth) ────────────────────────────────────────────────

function ShopifyConnectionCard({
  values, set, saveSection, savingSection,
}: {
  values: Record<string, string>;
  set: (key: string) => (v: string) => void;
  saveSection: (label: string, fields: Array<{ key: string; isSecret?: boolean }>) => void;
  savingSection: string | null;
}) {
  const { toast } = useToast();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const oauthResult = params.get('shopify');

  const [connecting, setConnecting] = useState(false);
  const { data: oauthStatus, refetch: refetchStatus } = useGetShopifyOAuthStatus();
  const disconnect = useDisconnectShopifyOAuth();

  // Show toast on redirect-back from Shopify
  useEffect(() => {
    if (oauthResult === 'connected') {
      toast({ title: 'Shopify connected', description: 'Your store is now linked. Run a sync to import your catalog.' });
      refetchStatus();
    } else if (oauthResult === 'error') {
      const reason = params.get('reason') ?? 'unknown';
      toast({ title: 'Shopify connection failed', description: `Error: ${reason}. Check your credentials and try again.`, variant: 'destructive' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthResult]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const result = await startShopifyOAuth() as { url: string };
      // Shopify's auth page blocks iframes (X-Frame-Options: SAMEORIGIN).
      // When running inside an iframe (e.g. Replit preview), open a new tab.
      // In production (top-level window), navigate in place.
      if (window.top !== window.self) {
        window.open(result.url, '_blank', 'noopener');
        toast({
          title: 'Shopify authorization opened',
          description: 'Complete the approval in the new tab. This page will update once you return.',
        });
        setConnecting(false);
      } else {
        window.location.href = result.url;
      }
    } catch {
      toast({ title: 'Could not start Shopify connection', description: 'Check that Store URL and Client ID are saved, then try again.', variant: 'destructive' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect.mutateAsync();
    toast({ title: 'Shopify disconnected', description: 'Tokens cleared. Re-connect to resume sync.' });
    refetchStatus();
  };

  const connected = oauthStatus?.connected ?? false;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Store className="h-4 w-4" />
          Shopify
        </CardTitle>
        <CardDescription>
          Connect your Shopify store for catalog sync, B2C hosted checkout, and B2B order push.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Connection status banner */}
        {connected ? (
          <div className="flex items-center gap-3 p-3 border border-green-200 bg-green-50 text-green-800 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Connected to {oauthStatus?.storeUrl}</p>
              {oauthStatus?.connectedAt && (
                <p className="text-xs opacity-75">Since {new Date(oauthStatus.connectedAt).toLocaleString()}</p>
              )}
              {!oauthStatus?.hasStorefrontToken && (
                <p className="text-xs text-amber-700 mt-1">
                  ⚠ Storefront API token missing — B2C checkout won't work.
                  In your Partner Dashboard app → <strong>Configuration</strong>, enable <strong>Storefront API integration</strong> and add the <code>unauthenticated_read_product_listings</code> and <code>unauthenticated_write_checkouts</code> scopes, then Disconnect and Reconnect here.
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" className="shrink-0 text-red-600 border-red-300 hover:bg-red-50"
              onClick={handleDisconnect} disabled={disconnect.isPending}>
              <Link2Off className="h-3.5 w-3.5 mr-1.5" />
              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 border bg-zinc-50 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>Not connected. Fill in your app credentials below then click <strong>Connect Shopify</strong>.</p>
          </div>
        )}

        {/* Step 1: App credentials (always editable) */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step 1 — App credentials</p>
          <p className="text-xs text-muted-foreground -mt-2">
            From your Shopify Dev Dashboard app → <strong>Settings</strong> tab.
          </p>
          <SettingField id="shopifyStoreUrl" label="Store URL" placeholder="my-shop.myshopify.com"
            description="Your .myshopify.com domain."
            value={values['shopifyStoreUrl'] ?? ''} onChange={set('shopifyStoreUrl')} />
          <SettingField id="shopifyClientId" label="Client ID"
            description="Client ID from your Dev Dashboard app's Settings tab."
            value={values['shopifyClientId'] ?? ''} onChange={set('shopifyClientId')} />
          <SettingField id="shopifyClientSecret" label="Client Secret" isSecret
            description="Secret from your Dev Dashboard app's Settings tab."
            value={values['shopifyClientSecret'] ?? ''} onChange={set('shopifyClientSecret')} />
        </div>

        {/* Save credentials then connect */}
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline"
            onClick={() => saveSection('Shopify credentials', [
              { key: 'shopifyStoreUrl' },
              { key: 'shopifyClientId' },
              { key: 'shopifyClientSecret', isSecret: true },
            ])}
            disabled={savingSection === 'Shopify credentials'}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {savingSection === 'Shopify credentials' ? 'Saving…' : 'Save credentials'}
          </Button>
          <Button size="sm"
            disabled={!values['shopifyStoreUrl'] || !values['shopifyClientId'] || connecting}
            onClick={handleConnect}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            {connecting ? 'Redirecting…' : connected ? 'Re-connect Shopify' : 'Connect Shopify'}
          </Button>
        </div>

        {/* Step 2: Redirect URI to register */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step 2 — Register redirect URI</p>
          <p className="text-xs text-muted-foreground">
            In your Dev Dashboard app → <strong>Configuration</strong>, add this as an allowed redirect URL:
          </p>
          <code className="block text-xs bg-zinc-100 px-3 py-2 font-mono break-all">
            {window.location.origin}/api/shopify/oauth/callback
          </code>
        </div>

        {/* Step 3: Additional settings after connection */}
        <div className="space-y-4 pt-2 border-t">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step 3 — Additional settings</p>
          {!oauthStatus?.hasStorefrontToken && (
            <SettingField id="shopifyStorefrontToken" label="Storefront API Token (manual)"
              isSecret
              description="Only needed if auto-creation failed during OAuth. Find it in Dev Dashboard → Settings."
              value={values['shopifyStorefrontToken'] ?? ''} onChange={set('shopifyStorefrontToken')} />
          )}
          <SettingField id="shopifyWebhookSecret" label="Legacy Webhook Secret (optional)" isSecret
            description="Leave blank for OAuth apps: Shopify signs orders/create with the Client Secret entered above. Use only for a migrated legacy integration."
            value={values['shopifyWebhookSecret'] ?? ''} onChange={set('shopifyWebhookSecret')} />
          <SettingField id="shopifySyncIntervalMinutes" label="Background Sync Interval (minutes)" placeholder="60"
            type="number" description="How often the catalog syncs automatically. Minimum 5."
            value={values['shopifySyncIntervalMinutes'] ?? ''} onChange={set('shopifySyncIntervalMinutes')} />
          <Button size="sm" variant="outline"
            onClick={() => saveSection('Shopify settings', [
              { key: 'shopifyStorefrontToken', isSecret: true },
              { key: 'shopifyWebhookSecret', isSecret: true },
              { key: 'shopifySyncIntervalMinutes' },
            ])}
            disabled={savingSection === 'Shopify settings'}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {savingSection === 'Shopify settings' ? 'Saving…' : 'Save settings'}
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

// ── Shopify sync & collection mapping ────────────────────────────────────────

function ShopifySyncCard() {
  const { toast } = useToast();
  const { data: status, refetch: refetchStatus } = useGetShopifySyncStatus();
  const { data: collections, isLoading: loadingCollections, error: collectionsError, refetch: refetchCollections } = useListShopifyCollections();
  const { data: stores } = useListStores();
  const updateMappings = useUpdateShopifyMappings();
  const runSync = useRunShopifySync();

  // collectionId -> selected storeIds (local edits)
  const [selection, setSelection] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (collections) {
      setSelection(Object.fromEntries(collections.map((c) => [c.id, c.storeIds])));
    }
  }, [collections]);

  const toggle = (collectionId: string, storeId: number) => {
    setSelection((prev) => {
      const current = prev[collectionId] ?? [];
      const next = current.includes(storeId) ? current.filter((s) => s !== storeId) : [...current, storeId];
      return { ...prev, [collectionId]: next };
    });
  };

  const saveMappings = async () => {
    try {
      await updateMappings.mutateAsync({
        data: { mappings: Object.entries(selection).map(([collectionId, storeIds]) => ({ collectionId, storeIds })) },
      });
      toast({ title: 'Saved', description: 'Collection mappings updated.' });
      refetchCollections();
    } catch (err: unknown) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleSync = async () => {
    try {
      const result = await runSync.mutateAsync();
      toast({
        title: result.success ? 'Sync complete' : 'Sync failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      refetchStatus();
    } catch (err: unknown) {
      toast({ title: 'Sync failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Store className="h-4 w-4" />
          Shopify Collections → Storefronts
        </CardTitle>
        <CardDescription>
          Map each Shopify collection to the storefronts that should carry its products, then run a sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {collectionsError ? (
          <p className="text-sm text-destructive">
            {(collectionsError as Error)?.message || 'Could not load collections. Check the Shopify credentials above.'}
          </p>
        ) : loadingCollections ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading collections from Shopify…</p>
        ) : !collections || collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collections found in the connected Shopify store.</p>
        ) : (
          <div className="space-y-3">
            {collections.map((c) => (
              <div key={c.id} className="border p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium">{c.title}</p>
                  <span className="text-xs text-muted-foreground font-mono">{c.productCount} products</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(stores ?? []).map((s) => {
                    const active = (selection[c.id] ?? []).includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(c.id, s.id)}
                        className={`px-2.5 py-1 text-xs border transition-colors ${
                          active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 hover:border-zinc-500'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t">
          <Button size="sm" onClick={saveMappings} disabled={updateMappings.isPending || !collections?.length}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {updateMappings.isPending ? 'Saving…' : 'Save Mappings'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={runSync.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${runSync.isPending ? 'animate-spin' : ''}`} />
            {runSync.isPending ? 'Syncing…' : 'Sync Now'}
          </Button>
          {status?.lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              Last sync: {new Date(status.lastSyncAt).toLocaleString()}
              {status.lastSyncSummary ? ` — ${status.lastSyncSummary}` : ''}
            </span>
          )}
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

      {/* Shopify */}
      <ShopifyConnectionCard values={values} set={set} saveSection={saveSection} savingSection={savingSection} />


      {/* Shopify collection mapping + sync */}
      <ShopifySyncCard />

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
