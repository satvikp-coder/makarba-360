import copy
import sys
import unittest
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import check_device_reports as D  # noqa: E402

ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36"
NOTES = "Pixel 7, Android 14, Chrome 130. Killed the app by swiping it away, reopened and re-ran. Airplane mode reload showed the page from cache."


def report(ua=ANDROID_UA, **over):
    r = {"probe": "makarba-offline-probe", "version": 1, "syntheticDataOnly": True, "isSecureContext": True, "userAgent": ua, "notes": NOTES,
         "results": [{"id": i, "status": "pass"} for i in D.REQUIRED_PASS]}
    r.update(over)
    return r


class DeviceReports(unittest.TestCase):
    def problems(self, r):
        return D.check_report(r)[1]

    def test_good_android_and_ios_reports_pass(self):
        self.assertEqual(D.check_report(report()), ("android", []))
        self.assertEqual(D.check_report(report(IOS_UA, notes=NOTES.replace("Pixel 7, Android 14, Chrome 130", "iPhone 13, iOS 17.5, Safari 17.5")))[0], "ios")
        self.assertEqual(self.problems(report(IOS_UA)), [])

    def test_desktop_and_headless_runs_are_never_device_evidence(self):
        self.assertTrue(any("not a real Android or iOS" in x for x in self.problems(report(DESKTOP_UA))))
        self.assertTrue(any("not a real Android or iOS" in x for x in self.problems(report("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"))))

    def test_each_required_check_must_pass(self):
        for rid in D.REQUIRED_PASS:
            r = report()
            for x in r["results"]:
                if x["id"] == rid:
                    x["status"] = "manual"
            self.assertTrue(any(f"'{rid}'" in x for x in self.problems(r)), rid)

    def test_any_failed_check_rejects(self):
        r = report()
        r["results"].append({"id": "limit", "status": "fail"})
        self.assertTrue(any("failed checks: limit" in x for x in self.problems(r)))

    def test_notes_must_describe_the_manual_steps(self):
        self.assertTrue(any("too short" in x for x in self.problems(report(notes="ok"))))
        self.assertTrue(any("airplane" in x for x in self.problems(report(notes="Pixel 7, Android 14, Chrome 130. Killed the app by swiping it away and reopened it later today."))))
        self.assertTrue(any("version number" in x for x in self.problems(report(notes="Some phone, some android, some chrome. Killed the app. Airplane mode reload worked fine."))))

    def test_wrong_file_or_flags_are_rejected(self):
        self.assertEqual(D.check_report({"hello": 1})[1], ["not an offline-probe report"])
        self.assertTrue(any("synthetic" in x for x in self.problems(report(syntheticDataOnly=False))))
        self.assertTrue(any("secure context" in x for x in self.problems(report(isSecureContext=False))))

    def test_overall_needs_both_platforms(self):
        import json, tempfile
        d = pathlib.Path(tempfile.mkdtemp())
        a = d / "a.json"; a.write_text(json.dumps(report()), encoding="utf8")
        i = d / "i.json"; i.write_text(json.dumps(report(IOS_UA)), encoding="utf8")
        self.assertEqual(D.main([str(a)]), 1)
        self.assertEqual(D.main([str(i)]), 1)
        self.assertEqual(D.main([str(a), str(i)]), 0)
        bad = d / "b.json"; bad.write_text("{not json", encoding="utf8")
        self.assertEqual(D.main([str(bad), str(a)]), 1)


if __name__ == "__main__":
    unittest.main()
