import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NgxAdvancedImgModule } from '../../projects/ngx-advanced-img/src/public-api';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    NgxAdvancedImgModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
