import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useLoginSuperAdmin } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Label } from '@/components/ui';

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  
  const loginMutation = useLoginSuperAdmin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation('/super-admin/dashboard');
      },
      onError: () => {
        setError('Invalid credentials');
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-zinc-50">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 text-zinc-50 rounded-none shadow-2xl">
        <CardHeader className="space-y-4 pb-8">
          <div className="w-12 h-12 bg-zinc-50 text-zinc-950 flex items-center justify-center font-bold text-xl tracking-tighter">
            SC
          </div>
          <div>
            <CardTitle className="text-2xl font-mono uppercase tracking-widest">Sys_Login</CardTitle>
            <CardDescription className="text-zinc-500 font-mono text-xs uppercase mt-2">Platform Command Center Access</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="text-red-500 text-sm font-mono bg-red-500/10 p-3 border border-red-500/20">{error}</div>}
            <div className="space-y-2">
              <Label className="font-mono text-xs text-zinc-400 uppercase tracking-wider">Operator ID</Label>
              <Input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="bg-zinc-900 border-zinc-800 text-zinc-100 rounded-none h-12 font-mono focus-visible:ring-zinc-700" 
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs text-zinc-400 uppercase tracking-wider">Passphrase</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="bg-zinc-900 border-zinc-800 text-zinc-100 rounded-none h-12 font-mono focus-visible:ring-zinc-700"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loginMutation.isPending}
              className="w-full h-12 rounded-none bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-mono uppercase tracking-widest text-sm transition-colors"
            >
              {loginMutation.isPending ? 'Authenticating...' : 'Initialize Session'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
