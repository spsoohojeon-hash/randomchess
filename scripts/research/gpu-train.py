"""One CUDA epoch; private, already-redacted sparse features only."""
import json, os, sys, random
import torch
from torch import nn

def device_check():
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA GPU unavailable; install CUDA-enabled PyTorch and NVIDIA driver')
    # Execute a real kernel, not just device enumeration (detect unsupported architectures).
    a=torch.randn(16,16,device='cuda',requires_grad=True)
    (a@a).sum().backward()
    torch.cuda.synchronize()
    return torch.cuda.get_device_name(0)

class Network(nn.Module):
    def __init__(self, data):
        super().__init__()
        s=data['shape']; self.description=data
        self.l1=nn.Linear(s['input'],s['h1']);self.l2=nn.Linear(s['h1'],s['h2'])
        self.policy=nn.Linear(s['h2'],s['output']);self.value=nn.Linear(s['h2'],1)
        self.mapping={'w1':self.l1.weight,'b1':self.l1.bias,'w2':self.l2.weight,'b2':self.l2.bias,'wp':self.policy.weight,'bp':self.policy.bias,'wv':self.value.weight,'bv':self.value.bias}
        with torch.no_grad():
            for k,p in self.mapping.items(): p.copy_(torch.tensor(data['weights'][k]).reshape(p.shape))
    def forward(self,x,actions):
        h=torch.relu(self.l2(torch.relu(self.l1(x))))
        return torch.einsum('bao,bo->ba',actions,self.policy(h)),torch.tanh(self.value(h)).squeeze(-1)
    def export(self):
        return {**self.description,'weights':{k:p.detach().cpu().flatten().tolist() for k,p in self.mapping.items()}}

def atomic(path,value):
    temp=path+'.tmp';
    with open(temp,'w',encoding='utf-8') as f: json.dump(value,f,allow_nan=False)
    os.replace(temp,path)

def main():
    name=device_check()
    if sys.argv[1]=='--check':
        print(json.dumps({'device':name,'torch':torch.__version__}));return
    config_path=sys.argv[1]
    with open(config_path,encoding='utf-8') as f: job=json.load(f)
    torch.set_num_threads(1);torch.manual_seed(3141+job['epoch'])
    model=Network(job['network']).to('cuda');opt=torch.optim.Adam(model.parameters(),lr=.001)
    checkpoint=job['checkpoint']
    if os.path.exists(checkpoint):
        old=torch.load(checkpoint,map_location='cuda',weights_only=True)
        if old.get('fingerprint')==job['fingerprint'] and old.get('epoch')==job['epoch']-1:
            opt.load_state_dict(old['optimizer'])
    with open(job['data'],encoding='utf-8') as f: rows=[json.loads(line) for line in f]
    random.Random(3141+job['epoch']).shuffle(rows)
    total=0.;s=job['network']['shape']
    for start in range(0,len(rows),32):
        batch=rows[start:start+32];n=len(batch);m=max(len(r['actions']) for r in batch)
        x=torch.zeros(n,s['input']);actions=torch.zeros(n,m,s['output']);mask=torch.zeros(n,m,dtype=torch.bool)
        for i,r in enumerate(batch):
            for j,v in r['x']: x[i,j]=v
            for j,a in enumerate(r['actions']):
                mask[i,j]=True
                for k,v in a: actions[i,j,k]=v
        targets=torch.tensor([r['target'] for r in batch],device='cuda')
        values=torch.tensor([r['value'] for r in batch],device='cuda',dtype=torch.float32)
        logits,pred=model(x.to('cuda'),actions.to('cuda'))
        loss=nn.functional.cross_entropy(logits.masked_fill(~mask.to('cuda'),float('-inf')),targets)+.5*nn.functional.mse_loss(pred,values)
        if not torch.isfinite(loss): raise RuntimeError('nonfinite_loss')
        opt.zero_grad();loss.backward();nn.utils.clip_grad_norm_(model.parameters(),5);opt.step()
        total+=loss.item()*n
    temp=checkpoint+'.tmp';torch.save({'fingerprint':job['fingerprint'],'epoch':job['epoch'],'optimizer':opt.state_dict()},temp);os.replace(temp,checkpoint)
    atomic(job['output'],{'network':model.export(),'loss':total/len(rows),'device':name})

if __name__=='__main__':
    try: main()
    except Exception:
        # No private feature data or paths in service logs.
        print('GPU training failed: check CUDA installation, driver, memory and private storage.',file=sys.stderr)
        sys.exit(1)
