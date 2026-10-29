// Thu vien cau ho lo to vui nhon (phong cach ganh lo to truyen thong, cau chu tu soan).
// Moi cau deu noi ro con so o cuoi de nguoi choi do theo. Admin co the them cau rieng (extraLines)
// qua cai dat tro choi; cac cau them duoc tron vao nhom cau chung.

export const OPENING_LINES = [
  "Bà con cô bác ổn định chỗ ngồi, chuẩn bị hạt bắp hạt đậu, ván lô tô bắt đầu đây!",
  "Kính mời bà con lắng tai nghe cho rõ, tay cầm bút, mắt nhìn bảng, lô tô khởi hành!",
  "Ván mới bắt đầu, chúc bà con may mắn, ai cũng có cơ hội kinh to!",
  "Đèn đã sáng, bi đã lăn, bà con sẵn sàng chưa nào!",
];

export const CLOSING_LINES = [
  "Ván này khép lại, cảm ơn bà con đã chơi cùng. Hẹn ván sau còn vui hơn!",
  "Hết ván! Ai chưa kinh đừng buồn, may mắn đang gõ cửa ván tới.",
  "Xin chúc mừng người thắng, bà con vỗ tay thật to nào!",
];

export const TEASING_LINES = [
  "Ai đang chờ một số duy nhất thì giơ tay nào… hồi hộp chưa!",
  "Có người mồ hôi tay rồi kìa, chờ con số định mệnh thôi!",
  "Bà con ngồi yên, đừng nôn nóng, số đẹp thường ra sau cùng!",
  "Nghe nói có bảng chỉ còn thiếu đúng một số, thật không nào?",
  "Càng về cuối càng gay cấn, bà con giữ chặt bảng của mình nhé!",
  "Ai chưa có số nào thì đừng lo, bi còn nhiều, cơ hội còn nguyên!",
];

export const NEAR_WIN_LINES = [
  "Ối chà, có người chỉ còn thiếu MỘT số nữa là kinh! Căng thẳng quá!",
  "Sắp kinh rồi kìa! Chỉ một số nữa thôi, bà con nín thở nào!",
  "Một số nữa thôi là nổ kinh! Ai đang chờ thì cầu may đi nhé!",
];

export const KINH_LINES = [
  "KINH RỒI NHÉ! Xin chúc mừng, cả nhà vỗ tay thật to nào!",
  "Nổ kinh rồi! Tuyệt vời, chúc mừng người thắng của ván này!",
  "Đã có người kinh! Tiếng pháo tay đâu rồi bà con ơi!",
];

/**
 * Cau rieng cho tung con so — viet theo dung dieu ganh hat lo to ma nguoi dung mo ta (30/10/2026):
 * moi cau la MOT CAU HAT DAI (hat thanh tieng khoang 15-20 giay, nhieu ve co van noi nhau),
 * cau hat KET THUC bang TU GOI SO o cuoi cau (anh Hai -> 2, nhay vui -> 7, con khi dot -> 11...),
 * sau do moi "lo" con so bang doan "... la con so N!" de nguoi choi do chac.
 */
export const NUMBER_LINES: Record<number, string> = {
  1: "Sân đình mở hội đầu năm, nêu cao dựng giữa trăng rằm sáng trong, một mình đứng giữa mênh mông, phất phơ cờ đỏ theo dòng gió chiều, cao cao chót vót… cây nêu… là con số 1!",
  2: "Gánh hát về tới đầu làng, trống kèn tưng bừng rộn ràng khắp thôn, người người kéo đến đông hơn, giọng ca ngọt lịm như đờn như ca, đến lượt cất giọng vang xa… anh Hai… là con số 2!",
  3: "Sáng nay trời đẹp nắng vàng, chị mang gánh lúa sang ngang cánh đồng, lúa vàng trĩu hạt mênh mông, tiếng cười trong trẻo như chuông như đàn, gánh qua cầu nhỏ dịu dàng… chị Ba… là con số 3!",
  4: "Chiều về bên bến sông quê, anh gánh đôi nước đi về sớm hôm, vai quang gánh nặng đường thôn, mồ hôi thấm áo mà hồn thảnh thơi, gánh đầy hai thùng nước tươi… anh Tư… là con số 4!",
  5: "Tay em têm miếng trầu cau, cánh phượng xếp đẹp đỏ au lạ thường, miếng trầu têm khéo dễ thương, mời nhau một miếng vấn vương nghĩa tình, têm xong đôi má hồng xinh… chị Năm… là con số 5!",
  6: "Đầu năm đi lễ chùa làng, khói hương nghi ngút dịu dàng bay xa, xin về một nhánh lộc đa, lộc non xanh biếc la đà đầu cành, mang về treo trước cửa xanh… lộc đầy… là con số 6!",
  7: "Đêm nay trăng sáng như gương, sân đình mở hội bốn phương tụ về, đèn lồng thắp sáng đường quê, trống chiêng thúc giục say mê lòng người, cô Ba múa lượn tuyệt vời, quay vòng theo nhịp… nhảy vui… là con số 7!",
  8: "Năm nay làm ăn thuận hòa, tiền vô như nước cửa nhà khang trang, chúc nhau năm mới an khang, tài lộc sung túc giàu sang hơn người, tám phương tụ lộc về chơi… phát tài… là con số 8!",
  9: "Vườn nhà cây trái sai cành, quả nào quả nấy trên nhành đung đưa, hương thơm theo gió sớm trưa, chim về ríu rít say sưa gọi bầy, hái vào một rổ đầy tay… trái chín… là con số 9!",
  10: "Đêm rằm trăng sáng trên cao, ánh trăng trải khắp cầu ao sân nhà, trăng tròn như chiếc mâm ngà, soi nghiêng mặt nước la đà bóng mây, mười người ngắm mười người say… trăng tròn… là con số 10!",
  11: "Rừng sâu thăm thẳm ngàn cây, tiếng chim tiếng vượn suốt ngày véo von, bước chân nặng trĩu đường mòn, bóng đen to lớn lom khom hiện hình, ngẩng đầu hú giữa lặng thinh… con khỉ đột… là con số 11!",
  12: "Quê em sông nước mênh mang, mười hai bến nước dọc ngang đôi bờ, thuyền nan xuôi ngược sớm trưa, người đi kẻ ở thẫn thờ nhớ thương, bến nào cũng nặng vấn vương… bến nước… là con số 12!",
  13: "Đêm khuya trăng đã lên cao, mười ba trăng sáng như sao trên trời, sân nhà vắng lặng người ơi, tiếng đàn ai gảy chơi vơi giữa đồng, nghe xong lòng bỗng mênh mông… trăng khuya… là con số 13!",
  14: "Trăng non mới nhú đầu non, mười bốn trăng khuyết vẫn còn thơ ngây, ánh trăng mỏng nhẹ như mây, soi lên đầu ngõ cỏ cây lặng thầm, chờ ngày trăng lớn dần dần… trăng non… là con số 14!",
  15: "Đêm nay trăng rằm sáng trong, mười lăm trăng tỏ như gương giữa trời, trẻ con rước đèn khắp nơi, tiếng cười rộn rã chơi vơi sân đình, trăng cao soi bóng lung linh… trăng rằm… là con số 15!",
  16: "Người ta bảo trăng mười lăm, sáng không bằng được mười sáu trăng đầy, mười sáu trăng sáng nhất đây, tròn vành vạnh tựa mâm mây giữa trời, ngắm trăng lòng thấy thảnh thơi… trăng mười sáu… là con số 16!",
  17: "Tuổi mười bảy sức tràn đầy, bẻ cong sừng trâu từ ngày còn xanh, trai làng khỏe mạnh nhanh nhanh, việc gì cũng tới tay anh xong liền, sức xuân phơi phới như tiên… sừng trâu… là con số 17!",
  18: "Hội làng tụ đủ anh hào, mười tám hảo hán tài cao khắp vùng, rượu đào nâng chén tưng bừng, nghĩa tình huynh đệ thủy chung một lòng, cụng ly cho thỏa chờ mong… anh hào… là con số 18!",
  19: "Đường lên đỉnh núi quanh co, mười chín bậc đá nhỏ to gập ghềnh, đứng trên đỉnh ngắm trời xanh, quê hương trải rộng như tranh dưới đồi, gió đưa mây trắng lưng trời… lưng đồi… là con số 19!",
  20: "Tuổi xuân đôi mươi đẹp thay, hai mươi tròn trịa như ngày đầu xuân, má hồng môi thắm trong ngần, ước mơ bay bổng xa gần khắp nơi, thanh xuân rực rỡ nhất đời… đôi mươi… là con số 20!",
  21: "Đầu xuân mở hội tưng bừng, hai mốt tháng giêng rộn ràng khắp nơi, trống chiêng vang dậy đất trời, cờ hoa rực rỡ người người vui xuân, cầu cho năm mới muôn phần… hội xuân… là con số 21!",
  22: "Ao làng nước mát trong veo, đôi con vịt trắng bơi theo nhau hoài, lội qua lội lại sớm mai, cánh xòe vỗ nước bắn bay tung trời, gọi nhau quạc quạc vui cười… đôi vịt… là con số 22!",
  23: "Đường xa có bạn đồng hành, hai ba cây số cũng thành gần thôi, qua đèo qua suối qua đồi, chia nhau ngụm nước miếng xôi dọc đường, tình bạn thắm thiết dễ thương… đồng hành… là con số 23!",
  24: "Một ngày hai bốn giờ vàng, giờ nào cũng quý như vàng như châu, thời gian trôi chẳng chờ đâu, trân quý từng phút trước sau vẹn toàn, ai ơi giữ lấy thời gian… giờ vàng… là con số 24!",
  25: "Đêm nay trăng sáng lạ thường, hai lăm trăng tỏ như gương treo trời, ánh vàng trải khắp nơi nơi, đường làng sáng rõ người người đi qua, ngắm trăng lòng bỗng thiết tha… trăng vàng… là con số 25!",
  26: "Sáng nay lộc ghé đầu ngõ, gõ cửa ba tiếng rõ to vang nhà, mở cửa đón lộc vào nhà, lộc mang phúc tới la đà đầy sân, người người vui vẻ quây quần… đầu ngõ… là con số 26!",
  27: "Đường dài muôn dặm xa xôi, hai bảy cây số qua đồi qua sông, chân đi vững bước thong dong, đá mềm chân cứng lòng không ngại ngần, đi hoài rồi cũng tới gần… đường dài… là con số 27!",
  28: "Hôm nay lộc tới bất ngờ, phát cho hai tay đầy ơ là đầy, tay ôm tay đỡ lộc này, lộc nhiều đến nỗi hai tay nặng trình, ai ơi đón lộc cho nhanh… hai tay… là con số 28!",
  29: "Ngọn cây cao vút trời xanh, hai chín mét chạm mây lành trên cao, vươn tay hái lộc trên cao, lộc treo lơ lửng như sao giữa trời, ai cao tay với tới nơi… mây xanh… là con số 29!",
  30: "Ba mươi ngày trọn một vòng, tháng tròn khép lại như dòng sông quay, trăng tròn rồi khuyết tháng này, thời gian lặng lẽ trôi bay không ngừng, khép vòng cho tháng tưng bừng… một vòng… là con số 30!",
  31: "Tháng này ba mốt ngày vui, ngày nào cũng trọn niềm vui đầy nhà, từ ngày đầu tháng đi qua, đến ngày cuối tháng chan hòa tiếng ca, trọn tháng an lành thiết tha… trọn tháng… là con số 31!",
  32: "Năm nay phúc lộc đủ đầy, ba hai nhà nhà sum vầy bên nhau, cơm no áo ấm dài lâu, cháu con quây quần trước sau một nhà, phúc lộc lan tỏa gần xa… sum vầy… là con số 32!",
  33: "Xưa kia có chuyện vá trời, ba ba đội đá một thời gian nan, đá chồng lên tận mây ngàn, vá cho trời khỏi mưa tràn xuống dân, tích xưa kể lại bao lần… vá trời… là con số 33!",
  34: "Anh em ở khắp bốn phương, ba bốn biển lớn quê hương một nhà, dù đi góc biển chân trời, trong lòng vẫn nhớ về nơi sinh thành, bốn bể là nhà thân tình… bốn bể… là con số 34!",
  35: "Giữa ngày nắng ấm ban trưa, ba lăm độ nắng chan hòa khắp nơi, nắng vàng trải khắp đất trời, ruộng đồng khô ráo người người phơi sân, nắng lên cho lúa chín dần… ban trưa… là con số 35!",
  36: "Vườn sau cây lá sum suê, ba sáu cành nhánh tràn trề sức xuân, chim về làm tổ quây quần, trái sai trĩu quả xa gần thơm hương, bóng râm che mát góc vườn… sum suê… là con số 36!",
  37: "Hôm qua mưa lớn như trút, hôm nay trời tạnh mây rút về xa, ba bảy phút sau mưa qua, cầu vồng bảy sắc hiện ra ngang trời, đẹp như tranh vẽ tuyệt vời… cầu vồng… là con số 37!",
  38: "Ông Địa bụm miệng cười tươi, bụng to phúc hậu người người đều yêu, tay cầm quạt mát sớm chiều, lộc rơi như lá bao nhiêu là tình, ông ngồi cười giữa sân đình… ông Địa… là con số 38!",
  39: "Sáng nay Thần Tài ghé qua, gõ cửa ba tiếng nhà ta rộn ràng, tay cầm thỏi ngọc thỏi vàng, lộc rơi đầy ngõ đầy làng đầy sân, đón ông vào nhà quây quần… Thần Tài… là con số 39!",
  40: "Bốn mươi tuổi đẹp nhất đời, như cây đến độ ra chồi nở hoa, trải qua bao nỗi phong ba, lòng người chín chắn mặn mà ngời ngời, tứ tuần là tuổi đẹp tươi… tứ tuần… là con số 40!",
  41: "Đường lên phía trước thênh thang, bốn mốt bước mở lối sang trang đời, mây quang trời tạnh sáng ngời, sao đêm dẫn lối người ơi đi cùng, đường dài mà dạ thong dong… sao đêm… là con số 41!",
  42: "Hôm nay song hỷ lâm môn, bốn hai niềm vui về thôn rộn ràng, nhà trên nhà dưới khang trang, cờ hoa rực rỡ họ hàng đông vui, niềm vui nhân đôi ngất trời… lâm môn… là con số 42!",
  43: "Ba chân kiềng sắt vững vàng, bốn ba thế đứng hiên ngang giữa trời, gió to sóng lớn mặc đời, kiềng này không ngã không dời đi đâu, vững như núi đứng dài lâu… kiềng sắt… là con số 43!",
  44: "Đôi cánh sải rộng tung bay, bốn bốn cánh én liệng bay ngang trời, vút lên tận chín tầng mây, nhìn xuống mặt đất thấy đời thênh thang, cánh chim bay khắp giang san… tung bay… là con số 44!",
  45: "Đi qua giữa chặng đường hoa, bốn lăm cây số hoa ra đầy đường, hoa thơm nở khắp quê hương, bước chân nhẹ nhõm vấn vương hương nồng, đường hoa đẹp tựa đường hồng… đường hoa… là con số 45!",
  46: "Lộc vào cuồn cuộn như sông, bốn sáu dòng nước mênh mông chảy về, nước sông đầy ắp bờ đê, lộc theo dòng chảy tràn trề khắp nơi, cản không kịp nữa người ơi… như sông… là con số 46!",
  47: "Đi xa mới nhớ quê nhà, bốn bảy năm nhớ thiết tha trong lòng, sao khuya dẫn lối về đông, đường về quê mẹ mênh mông tình người, dù đi góc biển chân trời… quê hương… là con số 47!",
  48: "Một năm lộc phát bốn mùa, bốn tám mùa lộc thay nhau ghé về, xuân sang lộc đến tràn trề, hạ thu đông cũng chẳng hề thiếu chi, mùa nào lộc cũng đến kỳ… bốn mùa… là con số 48!",
  49: "Leo lên bốn chín bậc thang, bậc thang cuối chạm huy hoàng trên cao, đứng trên đỉnh ngắm ánh sao, sao khuya nhấp nháy như chào người lên, một bậc nữa là tới thềm… ánh sao… là con số 49!",
  50: "Đi qua nửa chặng đường dài, năm mươi cây số ban mai rạng ngời, hoa niên rực rỡ đất trời, nửa đường còn lại người ơi vững lòng, đi thêm nửa nữa là xong… ban mai… là con số 50!",
  51: "Năm nay vận mới mở ra, năm mốt khởi đầu chan hòa niềm vui, gió lành thổi tới nơi nơi, xua tan mây xám cho trời quang trong, vận may theo đến thong dong… vận mới… là con số 51!",
  52: "Một năm năm hai tuần tròn, tuần nào cũng đẹp cũng còn niềm vui, ngày qua ngày lại êm xuôi, tiếng cười rộn rã khắp nơi trong nhà, trọn năm an lành chan hòa… trọn năm… là con số 52!",
  53: "Sáng nay tài lộc gõ cửa, năm ba lần gõ ban trưa rộn ràng, mở cửa đón lộc khang trang, lộc mang phúc tới đầy nhà đầy sân, người người hớn hở quây quần… gõ cửa… là con số 53!",
  54: "Bốn phương trời đất an hòa, năm bốn phương hướng chan hòa bình yên, nhà nhà êm ấm đoàn viên, tiếng cười vang khắp mọi miền quê hương, sống trong đầm ấm yêu thương… an hòa… là con số 54!",
  55: "Đôi bàn tay nắm chặt nhau, năm lăm ngón tay đan vào yêu thương, nắm tay đi hết con đường, dù cho gian khó gió sương chẳng rời, tay trong tay mãi không rời… tay nắm… là con số 55!",
  56: "Hiên nhà chuông gió treo cao, năm sáu chiếc chuông lao xao gió về, chuông reo leng keng say mê, lộc theo tiếng vọng tràn trề khắp sân, nghe chuông lòng thấy lâng lâng… chuông reo… là con số 56!",
  57: "Sáng tinh mơ sao mai lên, năm bảy phút nữa trời thêm sáng dần, sao mai rực rỡ trong ngần, báo ngày tốt đẹp muôn phần an vui, ngày mới may mắn tới nơi… sao mai… là con số 57!",
  58: "Quanh năm lộc ghé thăm nhà, năm tám lần ghé la đà đầy sân, mùa nào lộc cũng ân cần, ghé qua để lại muôn phần phúc may, nhà ta vui vẻ quây quần… ghé thăm… là con số 58!",
  59: "Vươn tay chạm đỉnh vinh quang, năm chín bậc thang huy hoàng trên cao, đứng trên đỉnh giữa ánh sao, vinh quang rực rỡ như bao ước mơ, bao ngày chờ đợi mong chờ… vinh quang… là con số 59!",
  60: "Sáu mươi năm một hoa giáp, một vòng đời trọn an khang thọ trường, cháu con sum họp bốn phương, mừng ông mừng bà yêu thương đầy nhà, hoa giáp rực rỡ như hoa… hoa giáp… là con số 60!",
  61: "Ván này mở màn lộc lớn, sáu mốt lộc về rộn ràng khắp làng, lộc to như hội mùa sang, người người hớn hở họ hàng đông vui, mở màn cho vận đổi đời… lộc lớn… là con số 61!",
  62: "Lộc về có cặp có đôi, sáu hai lộc sánh bước đôi đường dài, lộc đôi đi khắp đó đây, mang theo phúc tới nhà này nhà kia, đôi lộc đẹp tựa duyên thầm… lộc đôi… là con số 62!",
  63: "Phúc lộc thọ đủ tam đa, sáu ba tinh tú về nhà sáng soi, tam đa tề tựu đủ rồi, nhà ta hưởng trọn một đời an khang, phúc lộc thọ đến huy hoàng… tam đa… là con số 63!",
  64: "Một năm phát tài bốn mùa, sáu bốn mùa phát thay nhau tìm về, xuân sang hạ tới thu về, đông qua lộc vẫn tràn trề không vơi, bốn mùa phát lộc không ngơi… phát tài… là con số 64!",
  65: "Ra vườn cây trái đầy cành, sáu lăm quả chín trên nhành đung đưa, lộc nở khắp vườn sớm trưa, hương thơm ngan ngát say sưa lòng người, hái lộc mà miệng cười tươi… đầy vườn… là con số 65!",
  66: "Lộc này chồng chất thêm lộc, sáu sáu tầng lớp lộc chồng lên cao, lộc cao như núi như sao, chất đầy kho bãi biết bao là tình, lộc về nhà mình lung linh… lộc chồng… là con số 66!",
  67: "Phúc lộc đôi ngả song toàn, sáu bảy đường nào cũng toàn niềm vui, phúc về một ngả rạng ngời, lộc về ngả nữa cho đời thêm xuân, song toàn đôi ngả xa gần… song toàn… là con số 67!",
  68: "Lộc phát từng bước tiến lên, sáu tám bậc thềm vững bền đi lên, phát như diều lộng bay lên, vút cao tận chín tầng mây rạng ngời, tiến lên mãi mãi không ngơi… tiến lên… là con số 68!",
  69: "Vườn nhà lộc chín vàng ươm, sáu chín quả chín thơm hương ngạt ngào, hái về đầy giỏ đầy bao, lộc vàng rực rỡ như sao trên cành, mang sang biếu khắp xóm làng… vàng ươm… là con số 69!",
  70: "Bảy mươi thọ tựa núi cao, cổ lai hy ấy tự hào xưa nay, núi cao sừng sững tháng ngày, đời người thọ tựa núi này vững bền, cháu con kính chúc bề trên… núi cao… là con số 70!",
  71: "Bước đầu năm mới an khang, bảy mốt bước mở thênh thang đường đời, bước đi vững chãi người ơi, đường làng quen thuộc rạng ngời nắng xuân, an khang theo bước xa gần… an khang… là con số 71!",
  72: "Phúc về có cặp có đôi, bảy hai phúc sánh bước đôi về nhà, phúc đi hai ngả la đà, ngả nào cũng gặp chan hòa niềm vui, đôi phúc đẹp tựa đôi chim… đôi phúc… là con số 72!",
  73: "Tam tài thịnh vượng đầy nhà, bảy ba vượng khí chan hòa khắp nơi, nhà ta làm ăn rạng ngời, tiền vô như nước người người ấm no, thịnh vượng lan tỏa gần xa… thịnh vượng… là con số 73!",
  74: "Anh em ở khắp năm châu, bảy bốn phương trời về đâu cũng nhà, bốn bể đều là anh em, gặp nhau tay bắt mặt mừng thiết tha, tình thân gắn bó một nhà… anh em… là con số 74!",
  75: "Đi qua giữa chặng đường dài, bảy lăm cây số đường hoài còn xa, đường càng đi càng sáng ra, như gương soi tỏ người ta đi về, càng đi càng thấy say mê… như gương… là con số 75!",
  76: "Sáng nay lộc về đầy sân, bảy sáu bao lộc gần gần xa xa, quét hoài không hết lộc nhà, lộc nằm đầy ngõ la đà khắp nơi, ai qua cũng phải ngắm chơi… đầy sân… là con số 76!",
  77: "Đêm nay thất tinh hội tụ, bảy ngôi sao sáng trăng thu giữa trời, sao nào sao nấy rạng ngời, tụ về một chỗ sáng soi đêm trường, ngắm sao lòng thấy vấn vương… thất tinh… là con số 77!",
  78: "Lộc về như nước chảy hoài, bảy tám dòng nước chảy dài không vơi, nước trong suối mát ven đồi, chảy qua năm tháng người ơi không ngừng, lộc theo dòng nước tưng bừng… chảy hoài… là con số 78!",
  79: "Ông Thần Tài lớn ghé qua, bảy chín lộc lớn về nhà hôm nay, lộc to gõ cửa sớm mai, rộn ràng đầu ngõ người người ra xem, đón ông Tài lớn vào thềm… Tài lớn… là con số 79!",
  80: "Tám mươi thượng thọ an khang, cháu con sum họp rộn ràng quanh ông, mừng bà mừng thọ vui chung, tám mươi năm ấy thủy chung vẹn toàn, nhà ta phúc thọ đầy tràn… thượng thọ… là con số 80!",
  81: "Khởi đầu đại phát từ đầu, tám mốt vận phát dài lâu vững bền, phát ngay từ buổi đầu tiên, như cây đâm chồi vươn lên không ngừng, vận may theo mãi tưng bừng… dài lâu… là con số 81!",
  82: "Phát hoài phát mãi không ngừng, tám hai năm phát tưng bừng khắp nơi, như suối trong mát lưng đồi, chảy hoài chảy mãi người ơi không dừng, lộc về theo nhịp không ngừng… không ngừng… là con số 82!",
  83: "Tháng ba mở hội làng ta, tám ba ngày hội chan hòa niềm vui, lộc về như hội tháng ba, trống chiêng rộn rã người ta kéo về, hội làng vui khắp đường quê… tháng ba… là con số 83!",
  84: "Một năm hoa nở bốn mùa, tám bốn mùa hoa thay nhau khoe màu, xuân hoa hạ cũng hoa giàu, thu đông hoa nở trước sau rực hồng, bốn mùa hoa nở mênh mông… mùa hoa… là con số 84!",
  85: "Phát lộc đầy ắp cả nhà, tám lăm bao lộc la đà khắp nơi, lộc nhiều như cát biển khơi, đếm hoài không hết người ơi lộc nhiều, nhà ta lộc đến bao nhiêu… đầy nhà… là con số 85!",
  86: "Lộc về dồi dào như sóng, tám sáu đợt sóng dâng trào biển khơi, sóng sau cao hơn sóng đầu, lộc về lớp lớp trước sau đầy nhà, dồi dào như sóng bao la… dồi dào… là con số 86!",
  87: "Cây cao bóng mát sum suê, tám bảy tán lá tràn trề bóng râm, trưa hè ngồi dưới bóng cây, gió đưa mát rượi say sưa giấc nồng, bóng mát che khắp cánh đồng… bóng mát… là con số 87!",
  88: "Phát mãi phát mãi không thôi, tám tám đợt sóng trùng khơi dồn về, sóng sau nối tiếp sóng kia, phát như biển lớn chẳng hề nghỉ ngơi, phát hoài đến tận chân trời… trùng khơi… là con số 88!",
  89: "Lộc bền trường cửu dài lâu, tám chín năm lộc về sau vẫn còn, cửu cửu trường tồn núi non, lộc này giữ mãi cháu con đời đời, bền lâu như núi như trời… trường cửu… là con số 89!",
  90: "Chín mươi con số cuối bảng, khép cho trọn vòng huy hoàng ván nay, chín mươi số đã đủ đầy, bi lăn trọn vòng người ơi thỏa lòng, cảm ơn bà con đã trông… cuối bảng… là con số 90!",
};

/** Cau chung cho moi con so ({n} = con so). */
export const GENERIC_LINES = [
  "Cờ ra con mấy, con mấy gì đây… con số {n}!",
  "Bi lăn bi lăn, dừng lại ở… con số {n}!",
  "Nghe cho rõ, nhìn cho kỹ… con số {n}!",
  "Con số tiếp theo xin được gọi tên… số {n}!",
  "Ai chờ số này thì reo lên nào… con số {n}!",
  "Trống đánh vang vang, bi ra… con số {n}!",
  "Số gì đây, số gì đây… con số {n}!",
  "Mời bà con dò bảng… con số {n}!",
];

export type CallLineOptions = {
  /** 0..100: tan suat dung cau vui thay vi "So n" kho khan. */
  chatter: number;
  /** Cau rieng do admin them (tron vao nhom cau chung). */
  extraLines?: string[];
  /** Ham ngau nhien [0,1) de test duoc. */
  rand?: () => number;
};

const pick = <T,>(arr: readonly T[], rand: () => number): T => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];

/** Cau ho cho mot con so: co the la cau rieng, cau chung, hoac "So n" gon gang tuy tan suat chatter. */
export function callLineFor(n: number, opts: CallLineOptions): string {
  const rand = opts.rand ?? Math.random;
  const roll = rand() * 100;
  if (roll >= opts.chatter) return `Số ${n}`;
  const special = NUMBER_LINES[n];
  if (special && rand() < 0.75) return special;
  const pool = [...GENERIC_LINES, ...(opts.extraLines ?? []).filter((s) => s.trim().length > 0)];
  return pick(pool, rand).replaceAll("{n}", String(n));
}

export function randomLine(group: "opening" | "closing" | "teasing" | "nearWin" | "kinh", rand: () => number = Math.random): string {
  switch (group) {
    case "opening": return pick(OPENING_LINES, rand);
    case "closing": return pick(CLOSING_LINES, rand);
    case "teasing": return pick(TEASING_LINES, rand);
    case "nearWin": return pick(NEAR_WIN_LINES, rand);
    case "kinh": return pick(KINH_LINES, rand);
  }
}
