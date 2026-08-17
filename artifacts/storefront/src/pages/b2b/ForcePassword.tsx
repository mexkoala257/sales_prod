import { useState } from 'react';
import { useLocation, Redirect } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useChangeB2BPassword } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { Button, Input, Label } from '@/components/ui';

export default function B2BForcePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const { user, login } = useAuth();
  
  const changePassword = useChangeB2BPassword();

  if (!user || user.role !== 'b2b_client') return <Redirect to="/b2b/login" />;
  if (!user.forcePasswordChange) return <Redirect to="/b2b/catalog" />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    changePassword.mutate({ data: { currentPassword, newPassword } }, {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation('/b2b/catalog');
      },
      onError: (err: any) => {
        setError(err.message || 'Failed to update password');
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50">
      <Card className="w-full max-w-md border shadow-md rounded-none bg-white">
        <CardHeader className="space-y-2 pb-6 border-b text-center bg-zinc-900 text-white">
          <CardTitle className="text-xl font-serif tracking-tight">Security Update Required</CardTitle>
          <CardDescription className="text-zinc-300">Please establish a new permanent password</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="text-red-600 text-sm font-medium bg-red-50 p-3 border border-red-200 text-center">{error}</div>}
            <div className="space-y-2">
              <Label className="text-zinc-700 font-semibold text-xs uppercase tracking-wider">Current / Temporary Password</Label>
              <Input 
                type="password"
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                required 
                className="rounded-none h-11 border-zinc-300 focus-visible:ring-zinc-900 text-center font-mono" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-700 font-semibold text-xs uppercase tracking-wider">New Password</Label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required 
                minLength={8}
                className="rounded-none h-11 border-zinc-300 focus-visible:ring-zinc-900 text-center font-mono"
              />
            </div>
            <Button 
              type="submit" 
              disabled={changePassword.isPending}
              className="w-full h-12 rounded-none bg-zinc-900 text-white hover:bg-zinc-800 font-semibold uppercase tracking-widest text-sm transition-colors"
            >
              {changePassword.isPending ? 'Updating...' : 'Set Password & Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
