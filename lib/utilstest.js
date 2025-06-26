const clsx = (...inputs) => inputs.flat(Infinity).filter(Boolean).join(" "); // Simplified for Node!
const twMerge = (...classes) => clsx(...classes); // No real Tailwind merging in this test.
const cn = (...inputs) => twMerge(clsx(inputs));

const btnClass = cn("px-4", true && "bg-blue-600", ["rounded", "text-white"]);
console.log(btnClass); // Output: px-4 bg-blue-600 rounded text-white
