// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
import { getCandidateNames, type WebhookPayload } from "./candidateNames";

const ORG = "org_test";
const BUCKET_URL =
  "http://127.0.0.1:54321/storage/v1/object/public/attachments";

const payloadWith = (attachments: unknown[]) =>
  ({ old_record: { attachments } }) as WebhookPayload;

describe("getCandidateNames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the organization-scoped paths stored in the attachments", () => {
    const payload = payloadWith([
      { path: `${ORG}/0.8262106278726917.pdf` },
      { path: `${ORG}/0.1234` },
    ]);

    expect(getCandidateNames(payload, ORG)).toEqual([
      `${ORG}/0.8262106278726917.pdf`,
      `${ORG}/0.1234`,
    ]);
  });

  it("reads the path from the src URL when the path is missing or empty", () => {
    const payload = payloadWith([
      { src: `${BUCKET_URL}/${ORG}/0.11.pdf` },
      { path: "", src: `${BUCKET_URL}/${ORG}/0.22.png` },
      { path: null, src: `${BUCKET_URL}/${ORG}/0.33.my%20ext` },
    ]);

    expect(getCandidateNames(payload, ORG)).toEqual([
      `${ORG}/0.11.pdf`,
      `${ORG}/0.22.png`,
      `${ORG}/0.33.my ext`,
    ]);
  });

  it("ignores other organizations, legacy root files, and unsafe names", () => {
    const payload = payloadWith([
      { path: "org_other/0.1.txt" },
      { path: `${ORG}/../org_other/0.2.txt` },
      { path: `${ORG}/dir/0.12.txt` },
      { path: `${ORG}/attachments/0.13.txt` },
      { path: `${ORG}/logo.png` },
      { path: `${ORG}/0.14.tar.gz` },
      { path: `${ORG}/9.5e-7.pdf` },
      { path: "0.15.pdf" },
      { src: `${BUCKET_URL}/0.16.pdf` },
      { src: `${BUCKET_URL}/org_other/0.17.pdf` },
      { src: `${BUCKET_URL}/${ORG}/..%2F0.18.txt` },
      { src: "not a url" },
    ]);

    expect(getCandidateNames(payload, ORG)).toEqual([]);
  });

  it("returns each name once", () => {
    const payload = payloadWith([
      { path: `${ORG}/0.5.pdf` },
      { path: `${ORG}/0.5.pdf`, src: `${BUCKET_URL}/${ORG}/0.5.pdf` },
    ]);

    expect(getCandidateNames(payload, ORG)).toEqual([`${ORG}/0.5.pdf`]);
  });

  it("returns no names without an organization or usable attachments", () => {
    expect(getCandidateNames({}, ORG)).toEqual([]);
    expect(getCandidateNames({ old_record: null }, ORG)).toEqual([]);
    expect(
      getCandidateNames(payloadWith([{ path: `${ORG}/0.1.pdf` }]), ""),
    ).toEqual([]);
    expect(
      getCandidateNames(
        {
          old_record: { attachments: "0.1.pdf" },
        } as unknown as WebhookPayload,
        ORG,
      ),
    ).toEqual([]);
    expect(getCandidateNames(payloadWith([null, 42, {}]), ORG)).toEqual([]);
  });

  it("checks at most 100 names per call", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const payload = payloadWith(
      Array.from({ length: 120 }, (_, i) => ({
        path: `${ORG}/0.${i + 1}.pdf`,
      })),
    );

    const names = getCandidateNames(payload, ORG);

    expect(names).toHaveLength(100);
    expect(names[0]).toBe(`${ORG}/0.1.pdf`);
    expect(names[99]).toBe(`${ORG}/0.100.pdf`);
  });
});
