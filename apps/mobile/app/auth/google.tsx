import {Page,H,P} from '../../src/components/Ui';
/** Registered deep-link destination; login verification occurs in the waiting auth session. */
export default function NativeRelayReturn(){
 return <Page><H>正在完成登入驗證</H><P>請返回原本的登入畫面。</P></Page>;
}
