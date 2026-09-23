vector<int> g [mx], comp (mx), low (mx), num (mx), vis (mx);
stack<int> vert;
int ti=0;
int ncomp=0;
void tarzan(int u){
    low[u] = num[u] = ++ti;
    vis[u] = 2; // active
    vert.push(u);
 
    for (auto v: g[u]){
        if (!vis[v]){
            tarzan(v);
            low[u] = min(low[u], low[v]);
        }
        if (vis[v] == 2) low[u] = min(low[u], low[v]); // talvez o certo seja min(low[u], num[v]) mas vou usar assim até achar um erro
    }
 
    if (num[u] == low[u]){
        ncomp++;
        while (!vert.empty()){
            int v = vert.top(); vert.pop();
            comp[v] = ncomp;
            vis[v] = 1;
            if (u == v) break;
        }
    }
}