// Node's type stripping needs explicit extensions for relative imports,
// while the app sources rely on the bundler's extension-less resolution.
// This loader retries extension-less relative specifiers with `.ts`.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      /* fall through to the default resolution */
    }
  }
  return nextResolve(specifier, context);
}
