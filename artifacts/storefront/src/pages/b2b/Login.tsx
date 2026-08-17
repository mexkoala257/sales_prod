import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useLoginB2B } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { Button, Input, Label } from '@/components/ui';

export default function B2BLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  
  const loginMutation = useLoginB2B();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (data) => {
        login(data.token, data.user);
        if (data.user.forcePasswordChange) {
          setLocation('/b2b/force-password-change');
        } else {
          setLocation('/b2b/catalog');
        }
      },
      onError: () => {
        setError('Invalid credentials');
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 border-t-8 border-t-zinc-900">
      <Card className="w-full max-w-md border shadow-md rounded-none bg-white">
        <CardHeader className="space-y-2 pb-6 border-b text-center">
          <CardTitle className="text-xl font-serif tracking-tight">Wholesale Partner Portal</CardTitle>
          <CardDescription className="text-zinc-500">Secure procurement access</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="text-red-600 text-sm font-medium bg-red-50 p-3 border border-red-200 text-center">{error}</div>}
            <div className="space-y-2">
              <Label className="text-zinc-700 font-semibold text-xs uppercase tracking-wider">Corporate Email</Label>
              <Input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="rounded-none h-11 border-zinc-300 focus-visible:ring-zinc-900 text-center font-mono" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-700 font-semibold text-xs uppercase tracking-wider">Access Key</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="rounded-none h-11 border-zinc-300 focus-visible:ring-zinc-900 text-center font-mono"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loginMutation.isPending}
              className="w-full h-12 rounded-none bg-zinc-900 text-white hover:bg-zinc-800 font-semibold uppercase tracking-widest text-sm transition-colors"
            >
              {loginMutation.isPending ? 'Verifying...' : 'Access Portal'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
