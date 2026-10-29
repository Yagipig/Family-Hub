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
 * Cau rieng cho tung con so — dieu ganh hat lo to, nguoi dung chot 30/10/2026:
 * moi cau la MOT CAU HAT DAI 15-20 giay, nhieu ve co van noi nhau, va TU CUOI CUNG cua cau hat
 * CHINH LA TIENG HO SO do (anh Hai = 2, con khi dot = 11, hai bay = 27...) — cau hat ket thuc
 * ngay o tieng ho, KHONG co doan giai thich "la con so N" phia sau.
 */
export const NUMBER_LINES: Record<number, string> = {
  1: "Sân đình mở hội đầu năm, nêu cao dựng giữa trăng rằm sáng trong, một mình đứng giữa mênh mông, phất phơ cờ đỏ theo dòng gió bay, đứng đầu hàng nêu thẳng ngay, đầu tiên chỉ một… con một!",
  2: "Gánh hát về tới đầu làng, trống kèn tưng bừng rộn ràng khắp thôn, người người kéo đến đông hơn, giọng ca ngọt lịm như đờn như ca, đến lượt cất giọng vang xa… anh Hai!",
  3: "Sáng nay trời đẹp nắng vàng, chị mang gánh lúa sang ngang cánh đồng, lúa vàng trĩu hạt mênh mông, tiếng cười trong trẻo như chuông như đàn, gánh qua cầu nhỏ dịu dàng… chị Ba!",
  4: "Chiều về bên bến sông quê, anh gánh đôi nước đi về sớm hôm, vai quang gánh nặng đường thôn, mồ hôi thấm áo mà hồn thảnh thơi, gánh đầy hai thùng nước tươi… anh Tư!",
  5: "Tay em têm miếng trầu cau, cánh phượng xếp đẹp đỏ au lạ thường, miếng trầu têm khéo dễ thương, mời nhau một miếng vấn vương nghĩa tình, têm xong đôi má hồng xinh… chị Năm!",
  6: "Đầu năm đi lễ chùa làng, khói hương nghi ngút dịu dàng bay xa, xin về một nhánh lộc đa, lộc non xanh biếc la đà đầu cành, mang về treo trước cửa xanh, lộc đầy tay… anh Sáu!",
  7: "Đêm nay trăng sáng như gương, sân đình mở hội bốn phương tụ về, đèn lồng thắp sáng đường quê, trống chiêng thúc giục say mê lòng người, cô nàng múa lượn tuyệt vời, quay vòng nhảy múa… chị Bảy!",
  8: "Năm nay làm ăn thuận hòa, tiền vô như nước cửa nhà khang trang, chúc nhau năm mới an khang, tài lộc sung túc giàu sang hơn người, tám phương tụ lộc về chơi, phát tài nhờ… anh Tám!",
  9: "Vườn nhà cây trái sai cành, quả nào quả nấy trên nhành đung đưa, hương thơm theo gió sớm trưa, chim về ríu rít say sưa gọi bầy, trái nào trái nấy chín cây, hái về phần… anh Chín!",
  10: "Đêm rằm trăng sáng trên cao, ánh trăng trải khắp cầu ao sân nhà, trăng tròn như chiếc mâm ngà, soi nghiêng mặt nước la đà bóng mây, ai ơi ngắm thử trăng này, trăng tròn vừa đúng… tròn mười!",
  11: "Rừng sâu thăm thẳm ngàn cây, tiếng chim tiếng vượn suốt ngày véo von, bước chân nặng trĩu đường mòn, bóng đen to lớn lom khom hiện hình, ngẩng đầu hú giữa lặng thinh… con khỉ đột!",
  12: "Quê em sông nước mênh mang, bến nước dọc ngang đôi bờ mênh mông, thuyền nan xuôi ngược trên sông, người đi kẻ ở thẫn thờ nhớ thương, đếm hoài bến nước quê hương, đủ vừa… mười hai!",
  13: "Đêm khuya trăng đã lên cao, trăng soi sân vắng như sao trên trời, tiếng đàn ai gảy chơi vơi, nghe xong lòng bỗng mênh mông nỗi niềm, đêm nay là đêm… mười ba!",
  14: "Trăng non mới nhú đầu non, trăng còn thơ dại vẫn còn thơ ngây, ánh trăng mỏng nhẹ như mây, soi lên đầu ngõ cỏ cây lặng thầm, trăng lên đêm… mười bốn!",
  15: "Đêm nay trăng rằm sáng trong, trăng tỏ như gương giữa trời mênh mông, trẻ con rước đèn khắp xóm, tiếng cười rộn rã chơi vơi sân đình, trăng tròn đêm… mười lăm!",
  16: "Người ta bảo trăng mười lăm, sáng không bằng được trăng đầy hôm sau, trăng này sáng nhất đêm nào, tròn vành vạnh tựa mâm cao giữa trời, ngắm hoài đêm… mười sáu!",
  17: "Tuổi xuân sức trẻ tràn đầy, bẻ cong sừng trâu từ ngày còn xanh, trai làng khỏe mạnh nhanh nhanh, việc gì cũng tới tay anh xong liền, sức xuân năm… mười bảy!",
  18: "Hội làng tụ đủ anh hào, hảo hán tài cao khắp vùng về đây, rượu đào nâng chén tràn đầy, nghĩa tình huynh đệ thủy chung một lòng, đếm xem hảo hán về đông, đủ vừa… mười tám!",
  19: "Đường lên đỉnh núi quanh co, bậc đá nhỏ to gập ghềnh khó đi, đứng trên đỉnh ngắm trời mây, quê hương trải rộng như tranh dưới đồi, leo lên bậc… mười chín!",
  20: "Tuổi xuân đẹp nhất trong đời, má hồng môi thắm rạng ngời như hoa, ước mơ bay bổng trời xa, thanh xuân rực rỡ chan hòa niềm vui, tuổi xuân vừa độ… hai mươi!",
  21: "Đầu xuân mở hội tưng bừng, tháng giêng mở hội rộn ràng khắp nơi, trống chiêng vang dậy đất trời, cờ hoa rực rỡ người người vui xuân, hội xuân ngày… hai mốt!",
  22: "Ao làng nước mát trong veo, đôi con vịt trắng bơi theo nhau hoài, lội qua lội lại sớm mai, cánh xòe vỗ nước bắn bay tung trời, một đôi vịt nước… hai hai!",
  23: "Đường xa có bạn đồng hành, cây số đường dài cũng thành gần thôi, qua đèo qua suối qua đồi, chia nhau ngụm nước miếng xôi dọc đường, đi vừa… hai ba!",
  24: "Một ngày giờ ngọc trôi qua, giờ nào cũng quý như là vàng châu, thời gian trôi chẳng chờ đâu, trân quý từng phút trước sau vẹn toàn, một ngày đủ… hai bốn!",
  25: "Đêm nay trăng sáng lạ thường, trăng tỏ như gương treo cao giữa trời, ánh vàng trải khắp nơi nơi, đường làng sáng rõ người người đi qua, đêm nay đêm… hai lăm!",
  26: "Sáng nay lộc ghé đầu ngõ, gõ cửa ba tiếng rõ to vang nhà, mở cửa đón lộc vào nhà, lộc mang phúc tới la đà đầy sân, lộc về ngày… hai sáu!",
  27: "Đường dài muôn dặm xa xôi, cây số qua đồi qua sông không ngơi, chân đi vững bước thong dong, đá mềm chân cứng lòng không ngại ngần, đi vừa… hai bảy!",
  28: "Hôm nay lộc tới bất ngờ, phát cho hai tay đầy ơ là đầy, tay ôm tay đỡ lộc này, lộc nhiều đến nỗi nặng trình đôi tay, lộc về ngày… hai tám!",
  29: "Ngọn cây cao vút trời xanh, vươn tay hái lộc trên cành cao cao, lộc treo lơ lửng như sao, ai cao tay với hái vào đầy tay, cây cao… hai chín!",
  30: "Ngày qua tháng lại xoay vòng, trăng tròn rồi khuyết như dòng sông quay, thời gian lặng lẽ trôi bay, khép vòng một tháng đủ đầy ngày công, một vòng vừa… ba mươi!",
  31: "Tháng này ngày tháng êm trôi, ngày nào cũng trọn niềm vui đầy nhà, từ ngày đầu tháng đi qua, đến ngày cuối tháng chan hòa tiếng ca, tháng này đủ… ba mốt!",
  32: "Năm nay phúc lộc đủ đầy, nhà nhà sum vầy bên nhau sớm hôm, cơm no áo ấm dài lâu, cháu con quây quần trước sau một nhà, xóm làng đông đủ nhà nhà, đếm ra… ba hai!",
  33: "Xưa kia có chuyện vá trời, đội đá vá trời một thời gian nan, đá chồng lên tận mây ngàn, vá cho trời khỏi mưa tràn xuống dân, đội đá như là… ba ba!",
  34: "Anh em ở khắp bốn phương, biển lớn quê hương một nhà thân thương, dù đi góc biển chân trời, trong lòng vẫn nhớ về nơi sinh thành, anh em bốn bể thân tình, tuổi anh vừa… ba bốn!",
  35: "Giữa ngày nắng ấm ban trưa, nắng chan hòa khắp ruộng xưa vườn nhà, nắng vàng trải khắp đất trời, ruộng đồng khô ráo người người phơi sân, nắng lên vừa độ… ba lăm!",
  36: "Vườn sau cây lá sum suê, cành nhánh tràn trề sức xuân xanh tươi, chim về làm tổ quây quần, trái sai trĩu quả xa gần thơm hương, đếm cành cây ở trong vườn, cành vừa… ba sáu!",
  37: "Hôm qua mưa lớn như trút, hôm nay trời tạnh mây rút về xa, sau mưa trời lại quang ra, cầu vồng bảy sắc hiện ra ngang trời, mưa vừa tạnh phút… ba bảy!",
  38: "Ông Địa bụm miệng cười tươi, bụng to phúc hậu người người đều yêu, tay cầm quạt mát sớm chiều, lộc rơi như lá bao nhiêu là tình, ông ngồi cười giữa sân đình, tuổi ông vừa đúng… ba tám!",
  39: "Sáng nay Thần Tài ghé qua, gõ cửa ba tiếng nhà ta rộn ràng, tay cầm thỏi ngọc thỏi vàng, lộc rơi đầy ngõ đầy làng đầy sân, đón ông Tài tuổi… ba chín!",
  40: "Tuổi đời đẹp nhất là đây, như cây đến độ ra chồi nở hoa, trải qua bao nỗi phong ba, lòng người chín chắn mặn mà ngời ngời, tứ tuần tuổi đẹp… bốn mươi!",
  41: "Đường lên phía trước thênh thang, mở lối sang trang đời mới rạng ngời, mây quang trời tạnh sáng tươi, sao đêm dẫn lối người ơi đi cùng, bước chân vừa… bốn mốt!",
  42: "Hôm nay song hỷ lâm môn, niềm vui về thôn rộn ràng khắp nơi, nhà trên nhà dưới khang trang, cờ hoa rực rỡ họ hàng đông vui, niềm vui nhân gấp làm đôi, tuổi đời… bốn hai!",
  43: "Ba chân kiềng sắt vững vàng, thế đứng hiên ngang giữa trời vững chân, gió to sóng lớn mặc đời, kiềng này không ngã không dời đi đâu, vững vàng năm… bốn ba!",
  44: "Đôi cánh sải rộng tung bay, cánh én liệng bay ngang trời mênh mông, vút lên tận chín tầng mây, nhìn xuống mặt đất thấy đời thênh thang, cánh chim vừa… bốn bốn!",
  45: "Đi qua giữa chặng đường hoa, cây số đường xa hoa ra đầy đường, hoa thơm nở khắp quê hương, bước chân nhẹ nhõm vấn vương hương nồng, đường hoa dài… bốn lăm!",
  46: "Lộc vào cuồn cuộn như sông, dòng nước mênh mông chảy về không ngơi, nước sông đầy ắp bờ đê, lộc theo dòng chảy tràn trề khắp nơi, đếm dòng sông chảy về xuôi, dòng vừa… bốn sáu!",
  47: "Đi xa mới nhớ quê nhà, năm tháng thiết tha trong lòng không phai, sao khuya dẫn lối về đông, đường về quê mẹ mênh mông tình người, xa quê đã… bốn bảy!",
  48: "Một năm lộc phát bốn mùa, mùa lộc thay nhau ghé về không ngơi, xuân sang lộc đến tràn trề, hạ thu đông cũng chẳng hề thiếu chi, một năm tính tháng đủ kỳ, tháng vừa… bốn tám!",
  49: "Leo lên bậc đá lên cao, bậc thang chạm tới huy hoàng trên cao, đứng trên đỉnh ngắm ánh sao, sao khuya nhấp nháy như chào người lên, leo vừa bậc… bốn chín!",
  50: "Đi qua nửa chặng đường dài, cây số đường dài ban mai rạng ngời, hoa niên rực rỡ đất trời, nửa đường còn lại người ơi vững lòng, đi vừa… năm mươi!",
  51: "Năm nay vận mới mở ra, khởi đầu chan hòa niềm vui khắp nơi, gió lành thổi tới nơi nơi, xua tan mây xám cho trời quang trong, vận may năm… năm mốt!",
  52: "Một năm tuần lễ êm trôi, tuần nào cũng đẹp cũng còn niềm vui, ngày qua ngày lại êm xuôi, tiếng cười rộn rã khắp nơi trong nhà, một năm đếm tuần đi qua, tuần vừa… năm hai!",
  53: "Sáng nay tài lộc gõ cửa, lần gõ ban trưa rộn ràng vang xa, mở cửa đón lộc khang trang, lộc mang phúc tới đầy nhà đầy sân, lộc gõ cửa lần… năm ba!",
  54: "Bốn phương trời đất an hòa, phương hướng chan hòa bình yên khắp nơi, nhà nhà êm ấm đoàn viên, tiếng cười vang khắp mọi miền quê hương, an hòa năm… năm bốn!",
  55: "Đôi bàn tay nắm chặt nhau, ngón tay đan vào yêu thương không rời, nắm tay đi hết con đường, dù cho gian khó gió sương chẳng rời, nắm tay nhau tuổi… năm lăm!",
  56: "Hiên nhà chuông gió treo cao, chiếc chuông lao xao gió về leng keng, chuông reo say mê lòng người, lộc theo tiếng vọng tràn trề khắp sân, chuông treo vừa… năm sáu!",
  57: "Sáng tinh mơ sao mai lên, trời thêm sáng dần muôn phần an vui, sao mai rực rỡ trong ngần, báo ngày tốt đẹp muôn phần may mắn, sáng nay phút… năm bảy!",
  58: "Quanh năm lộc ghé thăm nhà, lần ghé la đà đầy sân đầy nhà, mùa nào lộc cũng ân cần, ghé qua để lại muôn phần phúc may, lộc ghé nhà lần… năm tám!",
  59: "Vươn tay chạm đỉnh vinh quang, bậc thang huy hoàng trên cao rạng ngời, đứng trên đỉnh giữa ánh sao, vinh quang rực rỡ như bao ước mơ, leo lên bậc… năm chín!",
  60: "Một vòng hoa giáp êm trôi, một vòng đời trọn an khang thọ trường, cháu con sum họp bốn phương, mừng ông mừng bà yêu thương đầy nhà, hoa giáp vừa… sáu mươi!",
  61: "Ván này mở màn lộc lớn, lộc về rộn ràng khắp làng khắp thôn, lộc to như hội mùa sang, người người hớn hở họ hàng đông vui, mở màn vận mới đổi đời, tuổi đời… sáu mốt!",
  62: "Lộc về có cặp có đôi, lộc sánh bước đôi đường dài bên nhau, lộc đôi đi khắp đó đây, mang theo phúc tới nhà này nhà kia, đếm đôi lộc ghé nhà ta, đôi vừa… sáu hai!",
  63: "Phúc lộc thọ đủ tam đa, tinh tú về nhà sáng soi rạng ngời, tam đa tề tựu đủ rồi, nhà ta hưởng trọn một đời an khang, tam đa tuổi… sáu ba!",
  64: "Một năm phát tài bốn mùa, mùa phát thay nhau tìm về không vơi, xuân sang hạ tới thu về, đông qua lộc vẫn tràn trề khắp nơi, bốn mùa phát lộc không ngơi, tuổi đời… sáu bốn!",
  65: "Ra vườn cây trái đầy cành, quả chín trên nhành đung đưa thơm hương, lộc nở khắp vườn sớm trưa, hương thơm ngan ngát say sưa lòng người, đếm cây trong vườn nhà ta, cây vừa… sáu lăm!",
  66: "Lộc này chồng chất thêm lộc, tầng lớp lộc chồng lên cao ngất trời, lộc cao như núi như sao, chất đầy kho bãi biết bao là tình, lộc chồng lên lớp… sáu sáu!",
  67: "Phúc lộc đôi ngả song toàn, đường nào cũng toàn niềm vui rạng ngời, phúc về một ngả sáng tươi, lộc về ngả nữa cho đời thêm xuân, song toàn năm… sáu bảy!",
  68: "Lộc phát từng bước tiến lên, bậc thềm vững bền đi lên không ngơi, phát như diều lộng bay lên, vút cao tận chín tầng mây rạng ngời, bước lên bậc… sáu tám!",
  69: "Vườn nhà lộc chín vàng ươm, quả chín thơm hương ngạt ngào khắp vườn, hái về đầy giỏ đầy bao, lộc vàng rực rỡ như sao trên cành, đếm quả chín ở trên cây, quả vừa… sáu chín!",
  70: "Thọ cao tựa núi vững bền, cổ lai hy ấy xưa nay tự hào, núi cao sừng sững tháng ngày, đời người thọ tựa núi này không lay, tuổi ông vừa… bảy mươi!",
  71: "Bước đầu năm mới an khang, bước mở thênh thang đường đời rạng ngời, bước đi vững chãi người ơi, đường làng quen thuộc rạng ngời nắng xuân, bước chân vừa… bảy mốt!",
  72: "Phúc về có cặp có đôi, phúc sánh bước đôi về nhà bên nhau, phúc đi hai ngả la đà, ngả nào cũng gặp chan hòa niềm vui, đôi phúc vừa… bảy hai!",
  73: "Tam tài thịnh vượng đầy nhà, vượng khí chan hòa khắp nơi rạng ngời, nhà ta làm ăn sáng tươi, tiền vô như nước người người ấm no, thịnh vượng năm… bảy ba!",
  74: "Anh em ở khắp năm châu, phương trời về đâu cũng nhà thân thương, bốn bể đều là anh em, gặp nhau tay bắt mặt mừng thiết tha, anh em xa gần một nhà, tuổi anh… bảy bốn!",
  75: "Đi qua giữa chặng đường dài, cây số đường hoài còn xa thăm thẳm, đường càng đi càng sáng ra, như gương soi tỏ người ta đi về, đường dài vừa… bảy lăm!",
  76: "Sáng nay lộc về đầy sân, bao lộc gần gần xa xa kéo về, quét hoài không hết lộc nhà, lộc nằm đầy ngõ la đà khắp nơi, lộc về bao… bảy sáu!",
  77: "Đêm nay thất tinh hội tụ, bảy ngôi sao sáng trăng thu giữa trời, sao nào sao nấy rạng ngời, tụ về một chỗ sáng soi đêm trường, đếm sao trên trời quê hương, sao vừa… bảy bảy!",
  78: "Lộc về như nước chảy hoài, dòng nước chảy dài không vơi không ngừng, nước trong suối mát ven đồi, chảy qua năm tháng người ơi không dừng, đếm dòng nước chảy tưng bừng, dòng vừa… bảy tám!",
  79: "Ông Thần Tài lớn ghé qua, lộc lớn về nhà hôm nay rộn ràng, lộc to gõ cửa sớm mai, rộn ràng đầu ngõ người người ra xem, đón ông Tài tuổi… bảy chín!",
  80: "Thượng thọ an khang đầy nhà, cháu con sum họp rộn ràng quanh ông, mừng bà mừng thọ vui chung, năm tháng thủy chung vẹn toàn thiết tha, tuổi bà vừa… tám mươi!",
  81: "Khởi đầu đại phát từ đầu, vận phát dài lâu vững bền không ngơi, phát ngay từ buổi đầu tiên, như cây đâm chồi vươn lên không ngừng, vận may năm… tám mốt!",
  82: "Phát hoài phát mãi không ngừng, năm phát tưng bừng khắp nơi rạng ngời, như suối trong mát lưng đồi, chảy hoài chảy mãi người ơi không dừng, phát đều năm… tám hai!",
  83: "Tháng ba mở hội làng ta, ngày hội chan hòa niềm vui khắp nơi, lộc về như hội tháng ba, trống chiêng rộn rã người ta kéo về, hội làng ngày… tám ba!",
  84: "Một năm hoa nở bốn mùa, mùa hoa thay nhau khoe màu rực hồng, xuân hoa hạ cũng hoa giàu, thu đông hoa nở trước sau đầy vườn, hoa nở quanh năm không ngừng, mùa hoa vừa… tám bốn!",
  85: "Phát lộc đầy ắp cả nhà, bao lộc la đà khắp nơi đầy sân, lộc nhiều như cát biển khơi, đếm hoài không hết người ơi lộc nhiều, lộc về bao… tám lăm!",
  86: "Lộc về dồi dào như sóng, đợt sóng dâng trào biển khơi mênh mông, sóng sau cao hơn sóng đầu, lộc về lớp lớp trước sau đầy nhà, đếm đợt sóng vỗ bao la, đợt vừa… tám sáu!",
  87: "Cây cao bóng mát sum suê, tán lá tràn trề bóng râm mát lành, trưa hè ngồi dưới bóng cây, gió đưa mát rượi say sưa giấc nồng, bóng cây che mát cánh đồng, tuổi cây vừa… tám bảy!",
  88: "Phát mãi phát mãi không thôi, đợt sóng trùng khơi dồn về mênh mông, sóng sau nối tiếp sóng kia, phát như biển lớn chẳng hề nghỉ ngơi, đếm đợt sóng vỗ chân trời, đợt vừa… tám tám!",
  89: "Lộc bền trường cửu dài lâu, năm lộc về sau vẫn còn vững bền, cửu cửu trường tồn núi non, lộc này giữ mãi cháu con đời đời, lộc bền năm… tám chín!",
  90: "Con số cuối bảng là đây, khép cho trọn vòng huy hoàng ván nay, bao nhiêu số đã đủ đầy, bi lăn trọn vòng người ơi thỏa lòng, đếm số trên bảng mênh mông, số vừa… chín mươi!",
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
