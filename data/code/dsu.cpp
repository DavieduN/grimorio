class DSU{
  public:
    int n;
    vector<int> p, r, s;
 
    DSU(int nodes): p (nodes), r (nodes, 1), s (nodes, 1){
        n = nodes;
        for (int i=0; i<n; i++) p[i] = i;
    }
	  /*
    ll find(ll x){
        return (p[x] == x? x : p[x] = find(p[x]));
    }
    */
    int find(int x){
        int root=x;
        while (root != p[root]) root = p[root];
        int aux;
        while (x != p[x]){
            aux = p[x];
            p[x] = root;
            x = aux;
        }
        return x;
    }
 
    bool unite(int x, int y){
        x = find(x), y = find(y);
        if (x == y) return false;
        if (r[x] > r[y]) swap(x, y);
        if (r[x] == r[y]) r[y]++;
        s[y] += s[x];
        p[x] = y;
        n--;
        return true;
    }
 
};

