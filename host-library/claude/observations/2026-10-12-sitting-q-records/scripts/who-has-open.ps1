# Lists the programs that have a file OR FOLDER open under a path (what Sysinternals handle.exe does): every File handle in the system is duplicated
# into this process, asked for its path, and kept only when the path starts with -Path. Prints program name, process id and path. Changes nothing.
# Processes this user cannot open (elevated, protected) are counted, not listed. Takes about 2 seconds.
# new-run.ps1 calls it when the old folder of a scenario cannot be moved aside; it is also fine to run by hand:
#   pwsh -File scripts\who-has-open.ps1 -Path C:\github\scratch-pilot\h10d-local-test\h10k2-gemini
# Typical answers: explorer (a File Explorer window showing a folder inside), pwsh/cmd (a terminal whose current folder is inside), Code (an editor).
param([Parameter(Mandatory)][string]$Path)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class HandleHunt {
  [StructLayout(LayoutKind.Sequential)]
  struct Entry { public IntPtr Object; public IntPtr Pid; public IntPtr Handle; public uint Access; public ushort Back; public ushort TypeIndex; public uint Attr; public uint Reserved; }

  [DllImport("ntdll.dll")] static extern int NtQuerySystemInformation(int cls, IntPtr buf, int len, out int ret);
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool DuplicateHandle(IntPtr src, IntPtr h, IntPtr dst, out IntPtr dup, uint access, bool inherit, uint options);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern uint GetFileType(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern uint GetFinalPathNameByHandle(IntPtr h, StringBuilder s, uint len, uint flags);

  public static int Examined, Skipped, TimedOut, Total;

  static Entry[] Snapshot() {
    int size = 1 << 24;
    IntPtr buf = IntPtr.Zero;
    try {
      while (true) {
        buf = Marshal.AllocHGlobal(size);
        int ret;
        int st = NtQuerySystemInformation(64, buf, size, out ret);
        if (st == unchecked((int)0xC0000004)) { Marshal.FreeHGlobal(buf); buf = IntPtr.Zero; size = Math.Max(size * 2, ret + (1 << 20)); continue; }
        if (st != 0) throw new Exception("NtQuerySystemInformation " + st.ToString("X"));
        break;
      }
      long n = Marshal.ReadInt64(buf);
      var arr = new Entry[n];
      int stride = Marshal.SizeOf(typeof(Entry));
      for (long i = 0; i < n; i++) arr[i] = (Entry)Marshal.PtrToStructure(IntPtr.Add(buf, 16 + (int)(i * stride)), typeof(Entry));
      return arr;
    } finally { if (buf != IntPtr.Zero) Marshal.FreeHGlobal(buf); }
  }

  public static List<string> Find(string prefixLower) {
    var found = new List<string>();
    int me = Process.GetCurrentProcess().Id;
    ushort fileType = 0;
    string tmp = Path.GetTempFileName();
    using (var fs = new FileStream(tmp, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
      IntPtr mine = fs.SafeFileHandle.DangerousGetHandle();
      foreach (var e in Snapshot()) if (e.Pid.ToInt64() == me && e.Handle == mine) { fileType = e.TypeIndex; break; }
    }
    File.Delete(tmp);
    if (fileType == 0) throw new Exception("could not learn the type index of File handles");

    var all = Snapshot();
    Total = all.Length;
    var byPid = new Dictionary<int, List<Entry>>();
    foreach (var e in all) {
      if (e.TypeIndex != fileType) continue;
      int pid = (int)e.Pid.ToInt64();
      if (pid == me || pid == 0 || pid == 4) continue;
      uint a = e.Access;
      if (a == 0x0012019f || a == 0x001a019f || a == 0x00120189 || a == 0x00100000) continue; // access masks of pipes whose queries can block forever
      List<Entry> l; if (!byPid.TryGetValue(pid, out l)) { l = new List<Entry>(); byPid[pid] = l; }
      l.Add(e);
    }
    IntPtr cur = GetCurrentProcess();
    foreach (var kv in byPid) {
      IntPtr proc = OpenProcess(0x0040, false, kv.Key);
      if (proc == IntPtr.Zero) { Skipped++; continue; }
      string pname = "?"; try { pname = Process.GetProcessById(kv.Key).ProcessName; } catch { }
      foreach (var e in kv.Value) {
        IntPtr dup;
        if (!DuplicateHandle(proc, e.Handle, cur, out dup, 0, false, 2)) continue;
        Examined++;
        string path = null; var d = dup;
        var t = new Thread(() => {
          if (GetFileType(d) != 1) return;
          var sb = new StringBuilder(1024);
          uint n = GetFinalPathNameByHandle(d, sb, 1024, 0);
          if (n > 0 && n < 1024) path = sb.ToString();
        });
        t.IsBackground = true; t.Start();
        if (t.Join(250)) {
          CloseHandle(d);
          if (path != null && path.ToLowerInvariant().StartsWith(prefixLower)) found.Add(pname + " (pid " + kv.Key + ")  " + path);
        } else { TimedOut++; }
      }
      CloseHandle(proc);
    }
    return found;
  }
}
'@

$prefix = ('\\?\' + $Path.TrimEnd('\')).ToLowerInvariant()
$sw = [Diagnostics.Stopwatch]::StartNew()
$found = [HandleHunt]::Find($prefix)
'  {0} handles in the system, {1} file handles examined, {2} processes could not be opened, {3} queries timed out, {4:N0} s' -f [HandleHunt]::Total, [HandleHunt]::Examined, [HandleHunt]::Skipped, [HandleHunt]::TimedOut, $sw.Elapsed.TotalSeconds
if ($found.Count -eq 0) { '  nobody visible has a file or folder open under ' + $Path }
else { $found | Sort-Object -Unique | ForEach-Object { '  ' + $_.Replace('\\?\', '') } }
