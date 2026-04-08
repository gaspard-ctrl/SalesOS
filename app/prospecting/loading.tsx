export default function Loading() {
  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>
      <div className="px-6 py-4" style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
        <div className="h-7 w-40 rounded-lg animate-pulse" style={{ background: "#f0f0f0" }} />
        <div className="h-4 w-64 rounded animate-pulse mt-2" style={{ background: "#f5f5f5" }} />
      </div>
      <div className="flex-1 flex">
        <div className="flex-1 p-6 space-y-3">
          <div className="h-10 rounded-lg animate-pulse" style={{ background: "#fff", border: "1px solid #eee" }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "#fff", border: "1px solid #eee" }} />
          ))}
        </div>
        <div className="w-[45%] border-l p-6" style={{ borderColor: "#eee", background: "#fff" }}>
          <div className="h-6 w-48 rounded animate-pulse" style={{ background: "#f0f0f0" }} />
        </div>
      </div>
    </div>
  );
}
