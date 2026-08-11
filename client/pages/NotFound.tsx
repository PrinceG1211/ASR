import { ArrowLeft, SearchX } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#101516] px-6 text-[#eef2e8]">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b9e769]/10 text-[#b9e769]"><SearchX size={22} /></div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a8c76d]">sonora/lab</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">This route is out of range.</h1>
        <p className="mt-3 text-sm leading-6 text-[#818b8c]">The workspace you’re looking for doesn’t exist yet. Return to the overview to continue your research.</p>
        <Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#b9e769] px-4 py-2.5 text-xs font-bold text-[#172013] transition hover:bg-[#c9f27d]"><ArrowLeft size={14} />Back to overview</Link>
      </div>
    </div>
  );
};

export default NotFound;
