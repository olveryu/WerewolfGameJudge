// Batch background removal using Apple's Vision framework (local, free, offline).
//
// Uses VNGenerateForegroundInstanceMaskRequest — the same on-device model behind
// Finder's "Remove Background" Quick Action (macOS 14+). Produces transparent RGBA PNGs.
//
// Usage:
//   swift scripts/remove_bg_vision.swift <inputDir> <outputDir>
//
// Reads every *.png / *.jpg / *.jpeg / *.heic in <inputDir>, writes <stem>.png
// (transparent background) to <outputDir>. Requires macOS 14 (Sonoma) or newer.

import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO
import UniformTypeIdentifiers

func loadCGImage(_ url: URL) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return nil }
    return img
}

func savePNG(_ cg: CGImage, to url: URL) -> Bool {
    guard let dest = CGImageDestinationCreateWithURL(
        url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return false }
    CGImageDestinationAddImage(dest, cg, nil)
    return CGImageDestinationFinalize(dest)
}

func removeBackground(_ cg: CGImage, ctx: CIContext) -> CGImage? {
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    do {
        try handler.perform([request])
    } catch {
        FileHandle.standardError.write("  perform error: \(error)\n".data(using: .utf8)!)
        return nil
    }
    guard let result = request.results?.first else { return nil }
    do {
        let maskBuffer = try result.generateScaledMaskForImage(
            forInstances: result.allInstances, from: handler)
        let input = CIImage(cgImage: cg)
        let mask = CIImage(cvPixelBuffer: maskBuffer)
        let blend = CIFilter.blendWithMask()
        blend.inputImage = input
        blend.maskImage = mask
        blend.backgroundImage = CIImage.empty() // fully transparent background
        guard let output = blend.outputImage else { return nil }
        return ctx.createCGImage(output, from: input.extent)
    } catch {
        FileHandle.standardError.write("  mask error: \(error)\n".data(using: .utf8)!)
        return nil
    }
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("Usage: swift scripts/remove_bg_vision.swift <inputDir> <outputDir>")
    exit(2)
}

let fm = FileManager.default
let inDir = URL(fileURLWithPath: args[1], isDirectory: true)
let outDir = URL(fileURLWithPath: args[2], isDirectory: true)
try? fm.createDirectory(at: outDir, withIntermediateDirectories: true)

let exts: Set<String> = ["png", "jpg", "jpeg", "heic"]
let files = (try? fm.contentsOfDirectory(at: inDir, includingPropertiesForKeys: nil))?
    .filter { exts.contains($0.pathExtension.lowercased()) }
    .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
    ?? []

guard !files.isEmpty else {
    print("No images found in \(inDir.path)")
    exit(1)
}

let ctx = CIContext()
var ok = 0
var failed: [String] = []
print("Processing \(files.count) images from \(inDir.path)\n")
for (i, url) in files.enumerated() {
    let stem = url.deletingPathExtension().lastPathComponent
    guard let cg = loadCGImage(url) else {
        failed.append(stem); print("[\(i + 1)/\(files.count)] \(stem) — load failed"); continue
    }
    guard let cut = removeBackground(cg, ctx: ctx) else {
        failed.append(stem); print("[\(i + 1)/\(files.count)] \(stem) — no foreground"); continue
    }
    let outURL = outDir.appendingPathComponent("\(stem).png")
    if savePNG(cut, to: outURL) {
        ok += 1; print("[\(i + 1)/\(files.count)] \(stem) -> \(outURL.lastPathComponent)")
    } else {
        failed.append(stem); print("[\(i + 1)/\(files.count)] \(stem) — save failed")
    }
}

print("\nDone: \(ok)/\(files.count) succeeded.")
if !failed.isEmpty {
    print("Failed: \(failed.joined(separator: ", "))")
    exit(1)
}
