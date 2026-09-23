template <class T> class Segtree{
public:
    int n;
    T neutral;
    vector<T> t;
    Segtree(int size, T neutral): neutral(neutral){
        n = 1;
        while (size > n) n <<= 1;
        t.resize(2*n);
    }

    T op(T a, T b){
        return a + b;
    }

    T query(int l, int r, int idx, int a, int b){
        if (r < a || b < l) return neutral;
        if (l <= a && b <= r) return t[idx];
        int m = (a+b)/2;
        return op(query(l, r, 2*idx, a, m), query(l, r, 2*idx+1, m+1, b));
    }
    T query(int l, int r){ return query(l, r, 1, 0, n-1); }

    void add(int idx, T v){
        if (idx < 0 || idx >= n) return;
        t[idx += n] += v; // aqui era pra ser op() invés de +=
        for (idx >>= 1; idx; idx >>= 1) t[idx] = op(t[2*idx], t[2*idx+1]);
    }
};

