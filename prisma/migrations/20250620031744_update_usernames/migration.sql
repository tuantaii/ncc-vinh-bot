-- ...existing code...
-- UPDATE "UserBalance"
-- SET "username" = CASE "userId"
--   WHEN '1831544219827703808' THEN 'thien.nguyenvan'
--   WHEN '1803263641638670336' THEN 'anh.phamtien'
--   WHEN '1803692279202844672' THEN 'quan.hoangminh'
--   WHEN '1831544806493392896' THEN 'hien.nguyenthanh'
--   WHEN '1800396411926220800' THEN 'hien.ngothu'
--   WHEN '1840681640666337280' THEN 'Utility'
--   WHEN '1930090353453436928' THEN 'tinh.phamthe'
--   WHEN '1783441451758129152' THEN 'giang.tranminhchau'
--   WHEN '1793507391073947648' THEN 'thuan.nguyenleanh'
--   WHEN '1826837790373974016' THEN 'tien.caothicam'
--   WHEN '1831510401251020800' THEN 'toan.nguyenthanh'
--   WHEN '1783704549828071424' THEN 'dung.buihuu'
--   WHEN '1820658435042054144' THEN 'hoang.tranlehuy'
--   ELSE "username"
-- END
-- WHERE "userId" IN ('1831544219827703808', '1803263641638670336', '1803692279202844672', 
--                    '1831544806493392896', '1800396411926220800', '1840681640666337280', 
--                    '1930090353453436928', '1783441451758129152', '1793507391073947648', 
--                    '1826837790373974016', '1831510401251020800', '1783704549828071424', 
--                    '1820658435042054144');

UPDATE "UserBalance" ub
  SET "username" = COALESCE(bjg_data."hostName", bjg_data."guestName")
  FROM (
    SELECT DISTINCT ON ("hostId") "hostId" AS "userId", "hostName", NULL AS "guestName"
    FROM "BlackJackGame"
    WHERE "hostName" IS NOT NULL

    UNION ALL

    SELECT DISTINCT ON ("guestId") "guestId" AS "userId", NULL AS "hostName", "guestName"
    FROM "BlackJackGame"
    WHERE "guestName" IS NOT NULL
  ) AS bjg_data
  WHERE bjg_data."userId" = ub."userId";